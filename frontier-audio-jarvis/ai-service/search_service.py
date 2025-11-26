import requests
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS

class SearchService:
    def __init__(self):
        self.ddgs = DDGS()

    def search(self, query, max_results=3):
        """
        Performs a web search using DuckDuckGo.
        Tries the library first, then falls back to custom HTML scraping.
        """
        try:
            print(f"Searching web for: {query}")
            
            # Try library first (lite backend is often more reliable)
            try:
                results = list(self.ddgs.text(query, max_results=max_results, backend="lite"))
                if results:
                    return self._format_results(results)
            except Exception as e:
                print(f"Library search failed: {e}")
            
            # Fallback to custom HTML scraping
            print("Falling back to custom HTML scraping...")
            return self._custom_search(query, max_results)
            
        except Exception as e:
            print(f"Search error: {e}")
            return f"Error performing search: {str(e)}"

    def _custom_search(self, query, max_results):
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        payload = {'q': query}
        
        try:
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
