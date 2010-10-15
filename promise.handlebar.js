/*! Promise.Handlebar.js (Data/State Client)
	v0.0.1.1 (c) Kyle Simpson
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
			var publicAPI, queue = [], fail_queue = [], old_ret, promise_fulfilled = false, promise_failed = false;
			
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
						else if (ret_val && !(ret_val instanceof Promise)) old_ret = ret_val;
											
						queue.shift();
						
						if (ret_val && ret_val instanceof Promise) {
							promise_fulfilled = false;
							ret_val.then(function(P){ promise_fulfilled = true; promise_failed = false; return (old_ret = fulfill(P.value)); });
							break;
						}
					}
				}
			}
			
			function revoke(val) {
				var ret_val = val;
				if (typeof ret_val != "undefined") old_ret = ret_val;
				
				try {
					return val;
				}
				finally {
					for (var i=0,len=fail_queue.length; i<len; i++) {
						if (typeof ret_val != "undefined") old_ret = ret_val;
						
						ret_val = fail_queue[0].call(publicAPI,ret_val);
						
						if (typeof ret_val == "undefined") { ret_val = old_ret; }
						else if (ret_val && !(ret_val instanceof Promise)) old_ret = ret_val;
											
						queue.shift();
						
						if (ret_val && ret_val instanceof Promise) {
							promise_failed = false;
							ret_val.otherwise(function(P){ promise_failed = true; promise_fulfilled = false; return (old_ret = revoke(P.value)); });
							break;
						}
					}
				}
			}
					
			publicAPI = new Promise();
			
			publicAPI.then = function(cb){
				if (typeof cb == "function") queue[queue.length] = function(val){ return cb.call(publicAPI,{value:val}); };	// then() callback
				else queue[queue.length] = function(val){ return cb; };	// then() value
				if (promise_fulfilled) fulfill(old_ret);
				return publicAPI;
			};
			
			publicAPI.otherwise = function(cb){
				if (typeof cb == "function") fail_queue[fail_queue.length] = function(val){ return cb.call(publicAPI,{value:val}); };	// otherwise() callback
				else fail_queue[fail_queue.length] = function(val){ return cb; };	// otherwise() value
				if (promise_failed) revoke(old_ret);
				return publicAPI;
			};
			
			if (cb == null) {	// empty promise
				promise_fulfilled = true;
				promised_failed = false;
			}
			else if (typeof cb == "function") {	// promise callback
				cb.call(publicAPI,{fulfill:function(val){
					promise_fulfilled = true;
					promise_failed = false;
					fulfill.call(publicAPI,val);
				},revoke:function(val){
					promise_fulfilled = false;
					promise_failed = true;
					revoke.call(publicAPI,val);
				},value:undef});
			}
			else {	// immediate promise value
				promise_fulfilled = true;
				promise_failed = false;
				return publicAPI.then(cb);
			}
			
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
