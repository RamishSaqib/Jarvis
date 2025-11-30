import requests
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS
import os
from tavily import TavilyClient
from googlesearch import search as google_search
from fake_useragent import UserAgent
import random
import time
import wikipedia

class SearchService:
    def __init__(self):
        self.ddgs = DDGS()
        self.ua = UserAgent()
        self.tavily_client = None
        tavily_key = os.getenv("TAVILY_API_KEY")
        if tavily_key:
            try:
                self.tavily_client = TavilyClient(api_key=tavily_key)
                print("Tavily Search API initialized.")
            except Exception as e:
                print(f"Failed to initialize Tavily: {e}")

    def search(self, query, max_results=3):
        """
        Performs a web search using a hybrid strategy:
        1. Open-Meteo for weather queries (Free, Robust).
        2. Tavily API for general search (if key exists).
        3. DuckDuckGo Library (Lite backend).
        4. Wikipedia (Reliable for facts).
        5. Google Search (Fallback).
        6. Custom HTML Scraper (Last Resort).
        """
        try:
            print(f"Searching web for: {query}")
            errors = []
            
            # 1. Special handling for weather queries (Open-Meteo)
            if "weather" in query.lower():
                try:
                    weather_result = self._get_weather(query)
                    if weather_result:
                        return weather_result
                    else:
                        errors.append("Open-Meteo: No results or failed")
                except Exception as e:
                    print(f"Open-Meteo failed: {e}")
                    errors.append(f"Open-Meteo Error: {str(e)}")

            # 2. Tavily API (Best for general search)
            # 2. Tavily API (Best for general search)
            if self.tavily_client:
                try:
                    print("Using Tavily Search API (Client)...")
                    response = self.tavily_client.search(query, max_results=max_results)
                    return self._format_tavily_results(response.get("results", []))
                except Exception as e:
                    print(f"Tavily Client failed: {e}. Trying direct HTTP...")
                    try:
                        # Direct HTTP Fallback
                        payload = {
                            "api_key": os.getenv("TAVILY_API_KEY"),
                            "query": query,
                            "search_depth": "basic",
                            "include_answer": False,
                            "include_images": False,
                            "include_raw_content": False,
                            "max_results": max_results
                        }
                        response = requests.post("https://api.tavily.com/search", json=payload, timeout=10)
                        response.raise_for_status()
                        data = response.json()
                        return self._format_tavily_results(data.get("results", []))
                    except Exception as http_e:
                         print(f"Tavily HTTP failed: {http_e}")
                         errors.append(f"Tavily Error: {str(e)} | HTTP: {str(http_e)}")
            else:
                # Try direct HTTP even if client init failed (e.g. library issue) but key exists
                tavily_key = os.getenv("TAVILY_API_KEY")
                if tavily_key:
                     try:
                        print("Tavily Client missing, trying direct HTTP...")
                        payload = {
                            "api_key": tavily_key,
                            "query": query,
                            "search_depth": "basic",
                            "max_results": max_results
                        }
                        response = requests.post("https://api.tavily.com/search", json=payload, timeout=10)
                        response.raise_for_status()
                        data = response.json()
                        return self._format_tavily_results(data.get("results", []))
                     except Exception as http_e:
                         print(f"Tavily HTTP failed: {http_e}")
                         errors.append(f"Tavily Error: Key exists but client/HTTP failed. {str(http_e)}")
                else:
                    errors.append("Tavily: Key not configured")

            # 3. DuckDuckGo Library (Lite backend)
            try:
                print("Using DuckDuckGo (ddgs)...")
                results = list(self.ddgs.text(query, max_results=max_results, backend="lite"))
                if results:
                    return self._format_results(results)
                else:
                    errors.append("DDG: No results found")
            except Exception as e:
                print(f"DDG Library search failed: {e}")
                errors.append(f"DDG Lib Error: {str(e)}")
            
            # 4. Wikipedia (Reliable for facts)
            try:
                print("Falling back to Wikipedia...")
                wiki_result = self._wikipedia_search(query)
                if wiki_result:
                    return wiki_result
                else:
                    errors.append("Wikipedia: No results found")
            except Exception as e:
                print(f"Wikipedia search failed: {e}")
                errors.append(f"Wikipedia Error: {str(e)}")

            # 5. Google Search (Fallback)
            try:
                print("Falling back to Google Search...")
                results = self._google_search(query, max_results)
                if results:
                    return self._format_results(results)
                else:
                    errors.append("Google: No results found")
            except Exception as e:
                print(f"Google search failed: {e}")
                errors.append(f"Google Error: {str(e)}")

            # 6. Custom HTML Scraper (Last Resort)
            print("Falling back to custom HTML scraping...")
            scraper_result = self._custom_search(query, max_results)
            
            # Check if scraper returned a valid string result (success) or error message
            if "Search Results:" in scraper_result:
                return scraper_result
            else:
                errors.append(f"Scraper Error: {scraper_result}")
            
            # If we get here, all methods failed
            error_summary = "; ".join(errors)
            print(f"All search methods failed. Errors: {error_summary}")
            return f"Unable to perform search. Details: {error_summary}"
            
        except Exception as e:
            print(f"Search error: {e}")
            return f"Critical Search Error: {str(e)}"

    def _get_weather(self, query):
        """
        Extracts location and queries Open-Meteo API.
        """
        try:
            # Robust location extraction using regex
            import re
            # Match "weather in [Location]" or "forecast for [Location]"
            match = re.search(r'(?:weather|forecast)\s+(?:in|for)\s+(.+)', query, re.IGNORECASE)
            
            if match:
                clean_query = match.group(1).strip(" ?.,!")
            else:
                # Fallback: simple cleanup if regex doesn't match
                clean_query = query.lower().replace("weather", "").replace("current", "").replace("forecast", "").replace(" in ", " ").strip(" ?.,!")
            
            # Open-Meteo often fails with "City, State" format. 
            # It prefers just "City". Let's try to clean it further.
            if "," in clean_query:
                clean_query = clean_query.split(",")[0].strip()
                
            print(f"Extracted location for weather: '{clean_query}'")
            
            # Geocoding
            geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={clean_query}&count=1&language=en&format=json"
            headers = {"User-Agent": self.ua.random}
            geo_res = requests.get(geo_url, headers=headers, timeout=5).json()
            
            if not geo_res.get("results"):
                return None
                
            location = geo_res["results"][0]
            lat = location["latitude"]
            lon = location["longitude"]
            name = location["name"]
            admin1 = location.get("admin1", "")
            country = location.get("country", "")
            
            # Weather Data
            weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto"
            w_res = requests.get(weather_url, headers=headers, timeout=5).json()
            
            current = w_res.get("current", {})
            current_units = w_res.get("current_units", {})
            
            # WMO Weather Codes
            weather_codes = {
                0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
                45: "Fog", 48: "Depositing rime fog",
                51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
                61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
                71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
                95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
            }
            condition = weather_codes.get(current.get("weather_code"), "Unknown")
            
            report = f"Weather Report for {name}, {admin1} ({country}):\n"
            report += f"Condition: {condition}\n"
            report += f"Temperature: {current.get('temperature_2m')}{current_units.get('temperature_2m')}\n"
            report += f"Feels Like: {current.get('apparent_temperature')}{current_units.get('temperature_2m')}\n"
            report += f"Humidity: {current.get('relative_humidity_2m')}{current_units.get('relative_humidity_2m')}\n"
            report += f"Wind: {current.get('wind_speed_10m')}{current_units.get('wind_speed_10m')}\n"
            
            return report
            
        except Exception as e:
            print(f"Open-Meteo error: {e}")
            return None

    def _format_tavily_results(self, results):
        formatted_results = "Search Results (via Tavily):\n\n"
        for i, result in enumerate(results, 1):
            formatted_results += f"{i}. {result['title']}\n   {result['content']}\n   Source: {result['url']}\n\n"
        return formatted_results

    def _wikipedia_search(self, query):
        """
        Uses wikipedia library as a reliable fallback for facts.
        Includes query cleaning to remove search terms that confuse Wikipedia.
        """
        try:
            # Clean query: remove common search terms that confuse Wikipedia
            stop_words = ["imdb", "rating", "ratings", "review", "reviews", "plot", "cast", "summary", "wiki", "wikipedia"]
            clean_query = query
            # Case-insensitive replacement
            import re
            for word in stop_words:
                clean_query = re.sub(r'\b' + re.escape(word) + r'\b', '', clean_query, flags=re.IGNORECASE)
            
            # Remove extra spaces
            clean_query = " ".join(clean_query.split())
            print(f"Cleaned Wikipedia query: '{clean_query}'")

            # Search for pages
            search_results = wikipedia.search(clean_query, results=1)
            if not search_results:
                return None
            
            page_title = search_results[0]
            
            try:
                # Get page object first to handle disambiguation
                page = wikipedia.page(page_title, auto_suggest=False)
                summary = wikipedia.summary(page_title, sentences=3, auto_suggest=False)
            except wikipedia.DisambiguationError as e:
                print(f"Wikipedia disambiguation for '{page_title}', trying: {e.options[0]}")
                page_title = e.options[0]
                try:
                    page = wikipedia.page(page_title, auto_suggest=False)
                    summary = wikipedia.summary(page_title, sentences=3, auto_suggest=False)
                except Exception as e2:
                    print(f"Failed to resolve disambiguation: {e2}")
                    return None
            except wikipedia.PageError:
                print(f"Wikipedia page not found: {page_title}")
                return None
            
            formatted_result = "Search Results (via Wikipedia):\n\n"
            formatted_result += f"1. {page.title}\n   {summary}\n   Source: {page.url}\n\n"
            
            return formatted_result
        except Exception as e:
            print(f"Wikipedia internal error: {e}")
            return None

    def _google_search(self, query, max_results):
        """
        Uses googlesearch-python as a fallback.
        """
        results = []
        try:
            # advanced=True returns Result objects with title, url, description
            search_results = google_search(query, num_results=max_results, advanced=True)
            for res in search_results:
                results.append({
                    "title": res.title,
                    "href": res.url,
                    "body": res.description
                })
        except Exception as e:
            print(f"Google search internal error: {e}")
            return None
        return results

    def _custom_search(self, query, max_results):
        # Rotate User-Agents to avoid blocking
        headers = {
            "User-Agent": self.ua.random
        }
        payload = {'q': query}
        
        try:
            # Add a small random delay to be polite and avoid rate limits
            time.sleep(random.uniform(0.5, 1.5))
            
            response = requests.post("https://html.duckduckgo.com/html/", data=payload, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            results = []
            
            for result in soup.find_all('div', class_='result'):
                title_tag = result.find('a', class_='result__a')
                if not title_tag:
                    continue
                title = title_tag.get_text(strip=True)
                href = title_tag['href']
                
                snippet_tag = result.find('a', class_='result__snippet')
                snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
                
                results.append({
                    "title": title,
                    "href": href,
                    "body": snippet
                })
                
                if len(results) >= max_results:
                    break
            
            if not results:
                return "No results found."
                
            return self._format_results(results)
            
        except Exception as e:
            print(f"Custom search error: {e}")
            return f"Error performing search: {str(e)}"

    def _format_results(self, results):
        formatted_results = "Search Results:\n\n"
        for i, result in enumerate(results, 1):
            formatted_results += f"{i}. {result['title']}\n   {result['body']}\n   Source: {result['href']}\n\n"
        return formatted_results
