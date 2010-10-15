/*! XHR-Loader.Handlebar.js (Simple Templating Engine)
	v0.0.1.1 (c) Kyle Simpson
	MIT License
*/

(function(global){
	var _Loader = global.Handlebar.Loader || null,
		fOBJTOSTRING = Object.prototype.toString,
		fNOOP = function(){}
	;
	
	function engine() {
		var publicAPI,
			_util = global.Handlebar.Util,
			_file_cache = {}
		;
		
		function handleFile(xhr,src,cb) {
			if (xhr.readyState == 4) {
				xhr.onreadystatechange = fNOOP;
				_file_cache[src] = xhr.responseText;
				cb(xhr.responseText);
			}
		}
		
		function requestFile(src,forceReload) {
			forceReload = !(!forceReload);
			if (!forceReload && _file_cache[src]) {
				return global.Handlebar.Promise(_file_cache[src]);
			}
			else {
				return global.Handlebar.Promise(function(P){
					if (forceReload) src = _util.cacheBuster(src);
					var xhr = _util.createXHR();
					xhr.open("GET",src);
					xhr.setRequestHeader("X-Handlebar-Mode","raw");
					xhr.onreadystatechange = function(){ handleFile(xhr,src,P.fulfill); };
					xhr.send("");
				});
			}
		}
		
		publicAPI = {
			get:function(src,cb,forceReload){
				return requestFile(src,forceReload)
					.then(function(P){
						if (cb) return cb(P.value);
						else return P.value;
					})
				;
			},
			
			clone:function(){return engine();},
			noConflict:rollback
		};
				
		return publicAPI;
	};

	function rollback() {
		var _ld = global.Handlebar.Loader;
		global.Handlebar.Loader = _Loader;
		return _ld;
	}

	global.Handlebar.Loader = engine();
})(this);