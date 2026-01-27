// 修复后的generateSearchPageHtml方法
function generateSearchPageHtml() {
  return '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <title>Search Missing Persons</title>
    <link href="./dist/localtailwind.css" rel="stylesheet">
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        strong { font-weight: bold; color: red; }
        @media (min-width: 1024px) { 
            ::-webkit-scrollbar { width: 6px; } 
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; } 
        }
        .content-container { max-width: 800px; margin: 0 auto; }
        .search-input { border-radius: 20px; padding: 8px 16px; border: 1px solid #ddd; font-size: 16px; width: 100%; }
        .search-results { margin-top: 20px; max-height: 60vh; overflow-y: auto; }
        .result-item { padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; }
        .result-item:hover { background-color: #f5f5f5; }
        .result-name { font-weight: bold; font-size: 16px; }
        .result-id { font-size: 14px; color: #666; margin-top: 4px; }
        .loading { text-align: center; padding: 20px; color: #666; }
        .no-results { text-align: center; padding: 20px; color: #666; }
        body { padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
        .search-container { position: sticky; top: 0; background-color: white; padding: 10px 0; z-index: 100; }
    </style>
</head>
<body class="bg-gray-50 font-sans text-gray-900">
    <header class="bg-white shadow-md">
        <div class="content-container px-4 py-4 flex justify-between items-center">
            <div class="flex items-center space-x-2">
                <h1 class="text-2xl font-bold text-blue-600">Missing Persons Database</h1>
            </div>
            <nav>
                <ul class="flex space-x-4">
                    <li><a href="./index.html" class="text-gray-600 hover:text-blue-600">Home</a></li>
                    <li><a href="./search.html" class="text-blue-600 font-bold">Search</a></li>
                </ul>
            </nav>
        </div>
    </header>
    
    <main class="py-8">
        <div class="content-container px-4">
            <h1 class="text-3xl font-bold mb-8">Search Missing Persons</h1>
            
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search by name or case ID..." class="search-input">
            </div>
            
            <div id="searchResults" class="search-results">
                <div class="loading">Loading search data...</div>
            </div>
        </div>
    </main>
    
    <footer class="bg-gray-800 text-white py-8 safe-bottom">
        <div class="content-container px-4">
            <p class="text-center text-sm">Missing Persons Database © ' + new Date().getFullYear() + '</p>
        </div>
    </footer>
    
    <script>
        var searchData = [];
        
        function loadSearchData() {
            fetch("./dist/search_local.txt")
                .then(function(response) {
                    return response.text();
                })
                .then(function(text) {
                    searchData = text.split("\n")
                        .filter(function(line) {
                            return line.trim();
                        })
                        .map(function(line) {
                            var parts = line.split("|");
                            return {
                                name: parts[0],
                                caseId: parts[1],
                                path: parts[2]
                            };
                        });
                    
                    document.getElementById("searchResults").innerHTML = "<div class=\"no-results\">Start typing to search...</div>";
                })
                .catch(function(error) {
                    console.error("Error loading search data:", error);
                    document.getElementById("searchResults").innerHTML = "<div class=\"no-results\">Error loading search data. Please try again later.</div>";
                });
        }
        
        function performSearch(query) {
            if (!query.trim()) {
                document.getElementById("searchResults").innerHTML = "<div class=\"no-results\">Start typing to search...</div>";
                return;
            }
            
            var lowercaseQuery = query.toLowerCase();
            var results = searchData.filter(function(item) {
                return item.name.toLowerCase().includes(lowercaseQuery) ||
                       item.caseId.toLowerCase().includes(lowercaseQuery);
            });
            
            displayResults(results);
        }
        
        function displayResults(results) {
            var resultsContainer = document.getElementById("searchResults");
            
            if (results.length === 0) {
                resultsContainer.innerHTML = "<div class=\"no-results\">No matching results found.</div>";
                return;
            }
            
            var resultsHTML = "";
            for (var i = 0; i < results.length; i++) {
                var item = results[i];
                resultsHTML += "<div class=\"result-item\" onclick=\"window.location.href='./" + item.path + "/index.html'\"><div class=\"result-name\">" + escapeHtml(item.name) + "</div><div class=\"result-id\">Case ID: " + escapeHtml(item.caseId) + "</div></div>";
            }
            
            resultsContainer.innerHTML = resultsHTML;
        }
        
        function escapeHtml(text) {
            var div = document.createElement("div");
            div.textContent = text;
            return div.innerHTML;
        }
        
        document.addEventListener("DOMContentLoaded", function() {
            loadSearchData();
            
            var searchInput = document.getElementById("searchInput");
            searchInput.addEventListener("input", function() {
                performSearch(searchInput.value);
            });
            
            searchInput.focus();
        });
    </script>
</body>
</html>';
}

// 导出函数供其他模块使用
module.exports = generateSearchPageHtml;