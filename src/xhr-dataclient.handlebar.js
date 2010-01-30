/*! XHR-DataClient.Handlebar.js (Data/State Client)
	v0.0.1 (c) Kyle Simpson
	MIT License
*/

(function(global){
	var _DataClient = global.Handlebar.DataClient || null,
		fOBJTOSTRING = Object.prototype.toString,
		fNOOP = function(){}
	;
	
	function engine() {
		var publicAPI,
			_util = global.Handlebar.Util
		;
		
		function handleData(xhr,cb) {
			if (xhr.readyState == 4) {
				xhr.onreadystatechange = fNOOP;
				cb(JSON.parse(xhr.responseText),xhr);
			}
		}
		
		function requestData(src,data,cb) {
			if (typeof data !== "string") data = JSON.stringify(data);
			var xhr = _util.createXHR();
			xhr.open("GET",_util.cacheBuster(src)+"&REQUEST="+_util.encodeURIComponent(data));
			xhr.setRequestHeader("X-Handlebar-Mode","raw");
			xhr.onreadystatechange = function(){ handleData(xhr,cb); };
			xhr.send("");
		}
		
		publicAPI = {
			get:requestData,
			
			clone:function(){return engine();},
			noConflict:rollback
		};
				
		return publicAPI;
	};

	function rollback() {
		var _dc = global.Handlebar.DataClient;
		global.Handlebar.DataClient = _DataClient;
		return _dc;
	}

	global.Handlebar.DataClient = engine();
})(this);