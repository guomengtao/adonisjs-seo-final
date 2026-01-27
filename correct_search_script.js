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
        console.error("Error:", e);
    });

document.getElementById("s").oninput = function() {
    var q = this.value;
    var r = document.getElementById("r");
    
    if (!q) {
        r.innerHTML = "";
    } else {
        r.innerHTML = "...";
        setTimeout(function() {
            var f = data.filter(function(i) {
                return i.name.toLowerCase().indexOf(q.toLowerCase()) != -1 || 
                       i.caseNo.toLowerCase().indexOf(q.toLowerCase()) != -1;
            });
            
            var h = "";
            for (var i = 0; i < f.length; i++) {
                h += "<div onclick=\"window.location.href=\\'" + f[i].path + "\\'\">" + f[i].name + " - " + f[i].caseNo + "</div>";
            }
            
            r.innerHTML = f.length ? h : "No results";
        }, 200);
    }
};
