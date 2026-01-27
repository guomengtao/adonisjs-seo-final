// 正确的JavaScript代码
var data = [];
fetch("./dist/search_local.txt")
    .then(function(r) {
        return r.text();
    })
    .then(function(t) {
        data = t.split("\n")
            .filter(function(l) {
                return l.trim();
            })
            .map(function(l) {
                var p = l.split("|");
                return {
                    name: p[0],
                    caseNo: p[1],
                    path: p[2]
                };
            });
    })
    .catch(function(e) {
        console.error("加载失败", e);
    });

document.getElementById("s").oninput = function() {
    var q = this.value;
    var r = document.getElementById("r");
    
    if (!q) {
        r.innerHTML = "";
        return;
    }
    
    r.innerHTML = "...";
    
    setTimeout(function() {
        var f = data.filter(function(i) {
            return i.name.toLowerCase().includes(q.toLowerCase()) || 
                   i.caseNo.toLowerCase().includes(q.toLowerCase());
        });
        
        r.innerHTML = f.length ? 
            f.map(function(i) {
                return "<div onclick=\"window.location.href=\\'" + i.path + "\\'\">" + i.name + " - " + i.caseNo + "</div>";
            }).join("") : 
            "无结果";
    }, 100);
};