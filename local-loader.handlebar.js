/*! Local-Loader.Handlebar.js (Simple Templating Engine)
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
			_file_cache = {},
			FS = require("fs")
		;
		
		function requestFile(src,forceReload) {
			forceReload = !(!forceReload);
			return global.Handlebar.Promise((!forceReload && _file_cache[src]) ? _file_cache[src] : (_file_cache[src] = FS.read(src)));
		}
		
		publicAPI = {
			get:function(src,cb,forceReload){
				return requestFile(src,forceReload)
					.then(function(P){
						if (cb) return cb(P.value);	// allows for Loader.get() to be used with promises or with callbacks
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