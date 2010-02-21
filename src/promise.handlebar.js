/*! Promise.Handlebar.js (Data/State Client)
	v0.0.1 (c) Kyle Simpson
	MIT License
*/

(function(global){
	var _Promise = global.Handlebar.Promise || null,
		undef
	;
	
	function Promise(){}
	Promise.prototype.constructor = Promise;
	
	function engine() {
		var publicAPI = function(cb) {
			var publicAPI, queue = [], old_ret, promise_fulfilled = false;
			
			function fulfill(val) {
				var ret_val = val;
				if (typeof ret_val != "undefined") old_ret = ret_val;
				
				try {
					return val;
				}
				finally {
					for (var i=0,len=queue.length; i<len; i++) {
						if (typeof ret_val != "undefined") old_ret = ret_val;
						
						ret_val = queue[0].call(publicAPI,ret_val);
						
						if (typeof ret_val == "undefined") { ret_val = old_ret; }
						else if (ret_val && ret_val.constructor !== Promise) old_ret = ret_val;	// lame, V8 "instanceof" currently broken
											
						queue.shift();
						
						if (ret_val && ret_val.constructor === Promise) {	// lame, V8 "instanceof" currently broken
							promise_fulfilled = false;
							ret_val.then(function(P){ promise_fulfilled = true; return (old_ret = fulfill(P.value)); });
							break;
						}
					}
				}
			}
					
			publicAPI = new Promise();
			publicAPI.then = function(cb){
				queue[queue.length] = function(val){ return cb.call(publicAPI,{value:val}); };
				if (promise_fulfilled) fulfill(old_ret);
				return publicAPI;
			};
			
			cb.call(publicAPI,{fulfill:function(val){
				promise_fulfilled = true;
				fulfill.call(publicAPI,val);
			},value:undef});
			
			return publicAPI;
		};
		publicAPI.noConflict = rollback;
		
		return publicAPI;
	}
	
	function rollback() {
		var _pr = global.Handlebar.Promise;
		global.Handlebar.Promise = _Promise;
		return _pr;
	}

	if (typeof require !== "undefined" && (require.constructor !== Function)) {	// is the special core sandboxed "require"
		global.Handlebar.Promise = require("promise");
		global.Handlebar.Promise.noConflict = rollback;
		//global.Handlebar.Promise.clone = function(){return require("promise",true); };	// not needed since Promise is not yet a stateful plugin
	}
	else global.Handlebar.Promise = engine();
	
})(this);
