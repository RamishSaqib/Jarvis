"""
GitHub Integration Service for Jarvis
Provides code search and repository querying capabilities
"""

import os
from typing import Optional, List, Dict
import requests
from dotenv import load_dotenv

load_dotenv()

class GitHubService:
    def __init__(self):
        self.token = os.getenv("GITHUB_TOKEN", "")
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json"
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"
    
    def search_code(self, query: str, max_results: int = 5) -> List[Dict]:
        """
        Search for code across GitHub repositories
        
        Args:
            query: Search query (e.g., "useState language:javascript")
            max_results: Maximum number of results to return
            
        Returns:
            List of code search results with file info and snippets
        """
        try:
            url = f"{self.base_url}/search/code"
            params = {
                "q": query,
                "per_page": max_results
            }
            
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            results = []
            
            for item in data.get("items", [])[:max_results]:
                results.append({
                    "name": item.get("name"),
                    "path": item.get("path"),
                    "repository": item.get("repository", {}).get("full_name"),
                    "html_url": item.get("html_url"),
                    "score": item.get("score")
                })
            
            return results
        except Exception as e:
            print(f"Error searching GitHub code: {e}")
            return []
    
    def get_file_content(self, repo: str, path: str) -> Optional[str]:
        """
        Get the content of a specific file from a repository
        
        Args:
            repo: Repository name (e.g., "facebook/react")
            path: File path within the repository
            
        Returns:
            File content as string, or None if error
        """
        try:
            url = f"{self.base_url}/repos/{repo}/contents/{path}"
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            # GitHub API returns base64 encoded content
            import base64
            content = base64.b64decode(data.get("content", "")).decode("utf-8")
            return content
        except Exception as e:
            print(f"Error fetching file content: {e}")
            return None
    
    def search_repositories(self, query: str, max_results: int = 5) -> List[Dict]:
        """
        Search for repositories
        
        Args:
            query: Search query (e.g., "react hooks")
            max_results: Maximum number of results to return
            
        Returns:
            List of repository information
        """
        try:
            url = f"{self.base_url}/search/repositories"
            params = {
                "q": query,
                "sort": "stars",
                "order": "desc",
                "per_page": max_results
            }
            
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            results = []
            
            for item in data.get("items", [])[:max_results]:
                results.append({
                    "name": item.get("full_name"),
                    "description": item.get("description"),
                    "stars": item.get("stargazers_count"),
                    "language": item.get("language"),
                    "html_url": item.get("html_url")
                })
            
            return results
        except Exception as e:
            print(f"Error searching repositories: {e}")
            return []
    
    def is_code_related_query(self, text: str) -> bool:
        """
        Determine if a query is code-related
        
        Args:
            text: User query text
            
        Returns:
            True if query appears to be code-related
        """
        code_keywords = [
            "code", "function", "class", "method", "api", "library",
            "package", "module", "import", "syntax", "error", "bug",
            "implement", "programming", "developer", "repository",
            "github", "how to", "example", "tutorial", "documentation"
        ]
        
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in code_keywords)
    
    def get_code_context(self, query: str) -> Optional[str]:
        """
        Get relevant code context for a query
        
        Args:
            query: User's question
            
        Returns:
            Formatted string with code examples and links, or None
        """
        if not self.is_code_related_query(query):
            return None
        
        # Search for relevant code
        code_results = self.search_code(query, max_results=3)
        
        if not code_results:
            return None
        
        context = "I found some relevant code examples on GitHub:\n\n"
        
        for idx, result in enumerate(code_results, 1):
            context += f"{idx}. **{result['name']}** in {result['repository']}\n"
            context += f"   Link: {result['html_url']}\n"
            context += f"   Path: {result['path']}\n\n"
        
        return context

    def create_branch(self, repo: str, branch_name: str, base_branch: str = "main") -> bool:
        """Create a new branch from a base branch"""
        try:
            # Get SHA of base branch
            url = f"{self.base_url}/repos/{repo}/git/ref/heads/{base_branch}"
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            sha = response.json()["object"]["sha"]
            
            # Create new branch
            url = f"{self.base_url}/repos/{repo}/git/refs"
            data = {
                "ref": f"refs/heads/{branch_name}",
                "sha": sha
            }
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Error creating branch: {e}")
            return False

    def create_file(self, repo: str, path: str, content: str, message: str, branch: str) -> bool:
        """Create or update a file in a repository"""
        try:
            url = f"{self.base_url}/repos/{repo}/contents/{path}"
            
            # Check if file exists to get SHA (for update)
            sha = None
            try:
                resp = requests.get(url, headers=self.headers, params={"ref": branch})
                if resp.status_code == 200:
                    sha = resp.json()["sha"]
            except:
                pass

            import base64
            content_b64 = base64.b64encode(content.encode("utf-8")).decode("utf-8")
            
            data = {
                "message": message,
                "content": content_b64,
                "branch": branch
            }
            if sha:
                data["sha"] = sha
                
            response = requests.put(url, headers=self.headers, json=data)
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Error creating file: {e}")
            return False

    def create_pull_request(self, repo: str, title: str, body: str, head: str, base: str = "main") -> Optional[str]:
        """Create a pull request"""
        try:
            url = f"{self.base_url}/repos/{repo}/pulls"
            data = {
                "title": title,
                "body": body,
                "head": head,
                "base": base
            }
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()["html_url"]
        except Exception as e:
            print(f"Error creating PR: {e}")
            return None
