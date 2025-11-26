from duckduckgo_search import DDGS
import json

class SearchService:
    def __init__(self):
        self.ddgs = DDGS()

    def search(self, query, max_results=3):
        """
        Performs a web search using DuckDuckGo.
        """
        try:
            print(f"Searching web for: {query}")
            results = list(self.ddgs.text(query, max_results=max_results))
            
            if not results:
                return "No results found."
            
            formatted_results = "Search Results:\n\n"
            for i, result in enumerate(results, 1):
                formatted_results += f"{i}. {result['title']}\n   {result['body']}\n   Source: {result['href']}\n\n"
            
            return formatted_results
        except Exception as e:
            print(f"Search error: {e}")
            return f"Error performing search: {str(e)}"
