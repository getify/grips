/*! Local-DataClient.Handlebar.js (Data/State Client)
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
			_util = global.Handlebar.Util,
			OS = require("os")
		;
		
		function requestData(cmds,data) {
			if (data != null && typeof data !== "string") data = JSON.stringify(data);
			
			var pipes = OS.command.apply(global,cmds);
			if (data != null) pipes.stdin.write(data);
			
			return global.Handlebar.Promise(JSON.parse(pipes.stdout.read()));
		}
		
		publicAPI = {
			get:function(cmds,data,cb){
				return requestData(cmds,data)
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
		var _dc = global.Handlebar.DataClient;
		global.Handlebar.DataClient = _DataClient;
		return _dc;
	}

	global.Handlebar.DataClient = engine();
})(this);