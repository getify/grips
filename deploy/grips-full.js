/* grips (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/ */
;

// non-ES5 polyfill for Object.keys()
if (!Object.keys) {
	Object.keys = function __Object_keys__(obj) {
		var i, r = [];
		for (i in obj) { if (obj.hasOwnProperty(i)) {
			r.push(i);
		}}
		return r;
	};
}
// non-ES5 polyfill for Array.isArray
if (!Array.isArray) {
	Array.isArray = function __Array_isArray__(o) {
		return Object.prototype.toString(o) === "[object Array]";
	};
}



(function __grips_base__(global){
	var old_grips = global.grips;

	function createSandbox() {



		function RangeLiteralHash() {} // work-around for Chrome object iteration quirks

		function noConflict() {
			var new_grips = global.grips;
			global.grips = old_grips;
			return new_grips;
		}

		function initCollectionRecord(collectionID) {
			if (!(collectionID in collections)) {
				collections[collectionID] = {
					collection: "",
					extend: null,
					partials: {}
				};
			}
		}

		function extend(collectionID,id) {
			initCollectionRecord(collectionID);
			collections[collectionID].extend = id;
		}

		function cloneObj(obj) {
			var i, ret, ret2;
			if (typeof obj === "object") {
				if (obj === null) return obj;
				if (Array.isArray(obj)) {
					ret = [];
					for (i = 0; i < obj.length; i++) {
						if (typeof obj[i] === "object") {
							ret2 = cloneObj(obj[i]);
						}
						else {
							ret2 = obj[i];
						}
						ret.push(ret2);
					}
				}
				else {
					if (obj instanceof RangeLiteralHash) {
						ret = new RangeLiteralHash();
					}
					else {
						ret = {};
					}
					for (i in obj) {
						if (obj.hasOwnProperty(i)) {
							if (typeof(obj[i] === "object")) {
								ret2 = cloneObj(obj[i]);
							}
							else {
								ret2 = obj[i];
							}
							ret[i] = ret2;
						}
					}
				}
			}
			else {
				ret = obj;
			}
			return ret;
		}



		function definePartial(fn,id) {
			var collection_id = id.match(/^(.+)#/);
			if (collection_id) {
				collection_id = collection_id[1];
			}

			if (!collection_id) {
				throw unknown_error;
			}

			initCollectionRecord(collection_id);

			collections[collection_id].partials[id.replace(/^.*#/,"#")] = function __handle_partial__($,$$){
				var  ret;

				try {
					ret = fn($,$$);
				}
				catch (err) {

					throw unknown_error;
				}

				if (ret instanceof Error) {
					throw ret;
				}
				else {
					return ret;
				}
			};
		}


		function compile(sources,initialize) {
			var ret = "", i, collection_id;

			// default `initialize` to `true`
			initialize = (initialize !== false);

			if (Array.isArray(sources)) {
				for (i=0; i<sources.length; i++) {
					ret += compileCollection(sources[i],null,initialize);
				}
			}
			else if (typeof sources === "object") {
				for (collection_id in sources) { if (sources.hasOwnProperty(collection_id)) {
					ret += compileCollection(sources[collection_id],collection_id,initialize);
				}}
			}

			return ret;
		}

		function compileChunk(source,collectionID) {
			if (!collectionID) {
				throw unknown_error;
			}
			return compileCollection(source,collectionID,/*initialize=*/false);
		}

		function compileCollection(source,collectionID,initialize) {


			// default `initialize` to `true`
			initialize = (initialize !== false);

			try {
				if (_Grips.tokenizer.process(source,collectionID)) {
					_Grips.parser.end(); // end the collection stream
					return _Grips.generator.process(initialize);
				}
			}
			catch (err) {

				throw unknown_error;
			}
			return false;
		}

		function initialize(source) {
			var script = new Function(source);
			script.call(global);
		}

		function initializeCollection(collectionID,source) {
			initCollectionRecord(collectionID);
			initialize(source);
		}


		function render(id,$,$$) {
			// default empty render?
			if (!id) return "";

			// default empty objects for `data` and `locals` contexts
			$ = $ || {};
			$$ = $$ || {};

			var collection_id, ret = false, i, tmp, eligible_stack = [],
				collection_id_specified = false, collection_stack_pushed = false
			;

			// extract the collection ID, if any
			collection_id = id.match(/^(.+)#/);
			if (collection_id) {
				collection_id = collection_id[1];
				collection_id_specified = true;
			}

			// collection ID not specified but can be implied from stack?
			if (!collection_id_specified && render_collection_stack.length > 0) {
				collection_id = render_collection_stack[render_collection_stack.length-1];
			}
			// collection ID specified and not already on the stack?
			else if (collection_id_specified &&
				!(
					render_collection_stack.length > 0 &&
					render_collection_stack[render_collection_stack.length-1] === collection_id
				)
			) {
				render_collection_stack.push(collection_id);
				collection_stack_pushed = true;
			}
			// collection ID just plain missing
			else if (!collection_id) {
				throw unknown_error;
			}

			if (collection_id in collections) {
				id = id.replace(/^(.+)#/,"#");
				tmp = collection_id + id;
				render_partials_stack.push(tmp);

				// is there a recursive template include present?
				for (i=0; i<(render_partials_stack.length-1); i++) {
					if (render_partials_stack[i] === tmp) {
						throw unknown_error;
					}
				}

				// do we need to consult the current render stack?
				if (!collection_id_specified) {
					eligible_stack = eligible_stack.concat(render_collection_stack);
				}
				else {
					eligible_stack.push(collection_id);
				}

				// do we possibly need to consult the extensions stack?
				if (!(id in collections[collection_id].partials) &&
					collections[collection_id].extend
				) {
					// add any extensions onto the eligible stack
					tmp = collections[collection_id].extend;
					while (tmp && tmp in collections) {
						eligible_stack.push(tmp);
						tmp = collections[tmp].extend;
					}
				}

				// consult the eligible stack from the bottom up
				for (i=0; i<eligible_stack.length; i++) {
					if (id in collections[eligible_stack[i]].partials) {
						ret = collections[eligible_stack[i]].partials[id]($,$$);
						break;
					}
				}
			}

			if (ret !== false) {
				render_partials_stack.pop();
				if (collection_stack_pushed) {
					render_collection_stack.pop();
				}
				return ret;
			}
			else {
				throw unknown_error;
			}
		}

		// adapted from dust.js (http://akdubya.github.com/dustjs/)
		function strEscapes(str,escapes) {
			if (typeof str === "string") {
				if (escapes.html && /[&<>"]/.test(str)) {
					str = str
					.replace(/&/g,"&amp;")
					.replace(/</g,"&lt;")
					.replace(/>/g,"&gt;")
					.replace(/"/g,"&quot;");
				}
				if (escapes.string) {
					str = str
					.replace(/\\/g,"\\\\")
					.replace(/"/g,'\\"')
					.replace(/'/g,"\\'")
					.replace(/\r/g,"\\r")
					.replace(/\u2028/g,"\\u2028")
					.replace(/\u2029/g,"\\u2029")
					.replace(/\n/g,"\\n")
					.replace(/\f/g,"\\f")
					.replace(/\t/g,"\\t");
				}
				if (escapes.url) {
					str = encodeURIComponent(str);
				}
			}
			return str;
		}

		var _Grips, collections = {},
			unknown_error = new Error("Unknown error"),
			render_collection_stack = [], render_partials_stack = []
		;

		_Grips = {
			extend: extend,
			cloneObj: cloneObj,
			definePartial: definePartial,
			strEscapes: strEscapes,


			compile: compile,
			compileChunk: compileChunk,
			compileCollection: compileCollection,

			initialize: initialize,
			initializeCollection: initializeCollection,


			render: render,



			noConflict: noConflict,
			sandbox: createSandbox,

			RangeLiteralHash: RangeLiteralHash,

			collections: collections
		};

		return _Grips;
	}

	global.grips = createSandbox();

})(this);
;


(function __grips_tokenizer__(global,_Grips){

	/* Token */
	function Token(props) {
		for (var i in props) { if (props.hasOwnProperty(i)) {
			this[i] = props[i];
		}}
	}


	/* Tokenizer */
	function generateNewChunkID() {
		var id;
		do {
			id = Math.floor(Math.random() * 1E9);
		} while (id in chunk_ids);
		return id;
	}

	function process(chunk,collectionID) {

		function combineGeneralTokens(tokensSlice) {
			var start, end, i, j;

			for (i=0; i<tokensSlice.length; i++) {
				if (tokensSlice[i].type === TOKEN_GENERAL) {
					start = end = i;
					for (j=start+1; j<tokensSlice.length; j++) {
						end = j;
						if (tokensSlice[j].type !== TOKEN_GENERAL) {
							end = j-1;
							break;
						}
					}
					if (end > start) {
						for (j=start+1; j<=end; j++) {
							tokensSlice[start].val += tokensSlice[j].val;
						}
						tokensSlice.splice(start+1,end-start);
					}
					else i = j;
				}
			}

			return tokensSlice;
		}

		function unescapeGeneralTokens(tokensSlice) {
			for (var i=0; i<tokensSlice.length; i++) {
				if (tokensSlice[i].type === TOKEN_GENERAL) {
					tokensSlice[i].val = tokensSlice[i].val.replace(/\\\\/g,"\\");
				}
			}

			return tokensSlice;
		}

		function handleOutsideMatch() {
			var tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				token = new Token({
					type: null,
					val: unmatched
				});
				if (/^\s+$/.test(unmatched)) {
					token.type = TOKEN_TAG_WHITESPACE;
				}
				else {
					token.type = TOKEN_GENERAL;
				}
				tokens.push(token);
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				// is the match at the beginning or is it NOT escaped?
				if (!leftContext || not_escaped_pattern.test(leftContext)) {
					// block footer tag?
					if (match[0] === "{$}") {
						tokens.push(new Token({
							type: TOKEN_TAG_BLOCK_FOOTER,
							val: match[0]
						}));
					}
					// start of tag?
					else if (match[0] === "{$") {
						token = new Token({
							type: TOKEN_TAG_OPEN,
							val: match[0]
						});
						tokens.push(token);
						// look ahead to the tag-type signifier, if any
						if ((next_match_idx < chunk.length - 1) &&
							(match = chunk.substr(next_match_idx).match(/^(?:(?:~|escape\s+)[hsuHSU]+|[~:+=*\/%#]|(?:(?:define|extend|insert|print|partial|loop|let|comment|raw|escape)\b))/))
						) {
							tokens.push(new Token({
								type: TOKEN_TAG_SIGNIFIER,
								val: match[0]
							}));
							next_match_idx += match[0].length;
						}
						else {
							return unknown_error;
						}
					}
					// unexpected/unrecognized token, bail
					else {
						return unknown_error;
					}
				}
				// otherwise, since it was escaped, treat the match as just a general token
				else {
					tokens.push(new Token({
						type: TOKEN_GENERAL,
						val: match[0]
					}));
					// general tokens can't change the state of the parser, so skip the parse step for now
					return;
				}
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips.parser.nodify(tokensSlice,collectionID);
			token_idx = tokens.length;
		}

		function handleInsideMatch() {
			var tokensSlice, tmp;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				// check to see if there are any invalid token characters
				if ((tmp = unmatched.match(/[^a-z0-9_$\s]/i))) {
					return unknown_error;
				}
				else {
					tokens.push(new Token({
						type: TOKEN_GENERAL,
						val: unmatched
					}));
				}
			}
			if (match) {
				if (match[0] === "$}") {
					tokens.push(new Token({
						type: TOKEN_TAG_SIMPLE_CLOSE,
						val: match[0]
					}));
				}
				else if (match[0] === "}") {
					tokens.push(new Token({
						type: TOKEN_TAG_BLOCK_HEAD_CLOSE,
						val: match[0]
					}));
				}
				else if (/^\s+$/.test(match[0])) {
					tokens.push(new Token({
						type: TOKEN_TAG_WHITESPACE,
						val: match[0]
					}));
					// whitespace can't change the state of the parser, so skip the parse step for now
					return;
				}
				else if (/^["']$/.test(match[0])) {
					token = new Token({
						type: 0,
						val: match[0]
					});
					if (match[0] === "\"") token.type = TOKEN_TAG_DOUBLE_QUOTE;
					else token.type = TOKEN_TAG_SINGLE_QUOTE;

					tokens.push(token);

					parser_state_patterns[_Grips.parser.LITERAL] = new RegExp(match[0],"g");
					parser_state_patterns[_Grips.parser.LITERAL].lastIndex = 0; // reset to prevent browser "regex caching" bug
				}
				else if (/^(?:\.\.)|[:=?\(\)\[\],\-.!]$/.test(match[0])) {
					tokens.push(new Token({
						type: TOKEN_TAG_OPERATOR,
						val: match[0]
					}));
				}
				else if (match[0] === "|") {
					tokens.push(new Token({
						type: TOKEN_TAG_PIPE,
						val: match[0]
					}));
				}
				else if (match[0] === "@") {
					tokens.push(new Token({
						type: TOKEN_TAG_AT,
						val: match[0]
					}));
				}
				else if (/^~[hsuHSU]*$/.test(match[0])) {
					tokens.push(new Token({
						type: TOKEN_TAG_TILDE,
						val: match[0]
					}));
				}
				else {
					tokens.push(new Token({
						type: TOKEN_GENERAL,
						val: match[0]
					}));
					// general tokens can't change the state of the parser, so skip the parse step for now
					return;
				}
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips.parser.nodify(tokensSlice,collectionID);
			token_idx = tokens.length;
		}

		function handleRawMatch(){
			var tokensSlice, leftContext;

			// make sure we have a general content token for the current raw tag
			if (tokens[tokens.length-1].type !== TOKEN_GENERAL) {
				tokens.push(new Token({
					type: TOKEN_GENERAL,
					val: ""
				}));
			}

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tokens[tokens.length-1].val += unmatched;
			}
			if (match) {
				leftContext = tokens[tokens.length-1].val;

				// is the match at the beginning or is it NOT escaped?
				if (!leftContext || not_escaped_pattern.test(leftContext)) {
					tokens.push(new Token({
						type: TOKEN_TAG_RAW_CLOSE,
						val: match[0]
					}));

					// run the parser step, only on the unprocessed tokens
					tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
					parser_res = _Grips.parser.nodify(tokensSlice,collectionID);
					token_idx = tokens.length;
				}
				// otherwise just add the match to the literal's general content token
				else {
					// was it escaped?
					if (leftContext && !not_escaped_pattern.test(leftContext)) {
						tokens[tokens.length-1].val = tokens[tokens.length-1].val.substr(0,tokens[tokens.length-1].val.length-1);
					}
					tokens[tokens.length-1].val += match[0];
				}
			}
		}

		function handleCommentMatch(){
			var tokensSlice, leftContext;

			if (match) {
				leftContext = tokens[tokens.length-1].val;

				// is the match at the beginning or is it NOT escaped?
				if (!leftContext || not_escaped_pattern.test(leftContext)) {
					tokens.push(new Token({
						type: TOKEN_TAG_COMMENT_CLOSE,
						val: match[0]
					}));

					// run the parser step, only on the unprocessed tokens
					tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
					parser_res = _Grips.parser.nodify(tokensSlice,collectionID);
					token_idx = tokens.length;
				}
			}
		}

		function handleLiteralMatch(){
			var tokensSlice, leftContext;

			// make sure we have a general content token for the current literal
			if (tokens[tokens.length-1].type !== TOKEN_GENERAL) {
				tokens.push(new Token({
					type: TOKEN_GENERAL,
					val: ""
				}));
			}

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tokens[tokens.length-1].val += unmatched;
			}
			if (match) {
				leftContext = tokens[tokens.length-1].val;

				// is the match at the beginning or is it NOT escaped?
				if (!leftContext || not_escaped_pattern.test(leftContext)) {
					tokens.push(new Token({
						type: (match[0] === "\"" ? TOKEN_TAG_DOUBLE_QUOTE : TOKEN_TAG_SINGLE_QUOTE),
						val: match[0]
					}));

					// run the parser step, only on the unprocessed tokens
					tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
					parser_res = _Grips.parser.nodify(tokensSlice,collectionID);
					token_idx = tokens.length;

					// unset the pattern used to match the end of the literal
					parser_state_patterns[_Grips.parser.STRING_LITERAL] = null;
				}
				// otherwise just add the match to the literal's general content token
				else {
					// was it escaped?
					if (leftContext && !not_escaped_pattern.test(leftContext)) {
						tokens[tokens.length-1].val = tokens[tokens.length-1].val.substr(0,tokens[tokens.length-1].val.length-1);
					}
					tokens[tokens.length-1].val += match[0];
				}
			}
		}


		var regex, next_match_idx = 0, prev_match_idx = 0, token_idx = tokens.length,
			match, parser_state, unmatched, parser_res, token, res,
			
			match_handlers = [
				handleOutsideMatch,
				handleInsideMatch,
				handleRawMatch,
				handleCommentMatch,
				handleLiteralMatch
			]
		;

		// if we aren't given a `collectionID` to associate the parsing with, substitute a random unique chunk ID
		if (!collectionID) {
			collectionID = generateNewChunkID();
			chunk_ids[collectionID] = true;
			collectionID = "chunk_" + collectionID;
		}



		while ((!parser_res || parser_res === true) && next_match_idx < chunk.length) {
			unmatched = "";
			parser_res = null;
			parser_state = _Grips.parser.state;
			if (parser_state === _Grips.parser.INVALID) break;

			regex = parser_state_patterns[parser_state];

			if (regex) {
				regex.lastIndex = next_match_idx;
				match = regex.exec(chunk);

				if (match) {
					prev_match_idx = next_match_idx;
					next_match_idx = regex.lastIndex;

					// collect the previous string chunk not matched before this token
					if (prev_match_idx < next_match_idx - match[0].length) {
						unmatched = chunk.substring(prev_match_idx,next_match_idx - match[0].length);
					}
				}
				else {
					prev_match_idx = next_match_idx;
					next_match_idx = chunk.length;
					unmatched = chunk.substr(prev_match_idx);
					if (!unmatched) break;
				}



				// invoke the match handler for current parser state
				res = match_handlers[parser_state]();
				if (res && res !== true) break;
				if (parser_res && parser_res !== true) break;
			}
			else {
				parser_res = unknown_error;
				break;
			}
		}



		if (res instanceof Error) {
			throw res;
		}
		if (parser_res instanceof Error) {
			throw parser_res;
		}

		return true;
	}


	var tokens = [],
		chunk_ids = {},
		

		TOKEN_TAG_OPEN = 0,
		TOKEN_TAG_SIMPLE_CLOSE = 1,
		TOKEN_TAG_BLOCK_HEAD_CLOSE = 2,
		TOKEN_TAG_BLOCK_FOOTER = 3,
		TOKEN_TAG_SIGNIFIER = 4,
		TOKEN_TAG_COMMENT_CLOSE = 5,
		TOKEN_TAG_RAW_CLOSE = 6,
		TOKEN_TAG_PIPE = 7,
		TOKEN_TAG_AT = 8,
		TOKEN_TAG_STRING_LITERAL = 9,
		TOKEN_TAG_SINGLE_QUOTE = 10,
		TOKEN_TAG_DOUBLE_QUOTE = 11,
		TOKEN_TAG_OPERATOR = 12,
		TOKEN_GENERAL = 13,
		TOKEN_TAG_WHITESPACE = 14,
		TOKEN_TAG_TILDE = 15,

		not_escaped_pattern = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/,
		parser_state_patterns = [
			/\{\$\}|\{\$/g, /*outside*/
			/\$\}|\}|(?:\.\.)|(?:~[hsuHSU]*)|["':=@\|?\(\)\[\],\-.!#]|\s+/g, /*inside*/
			/%\$\}/g, /*raw*/
			/\/\$\}/g /*comment*/
		],

		unknown_error = new Error("Unknown error")
	;

	_Grips.tokenizer = {
		OPEN: TOKEN_TAG_OPEN,
		SIMPLE_CLOSE: TOKEN_TAG_SIMPLE_CLOSE,
		BLOCK_HEAD_CLOSE: TOKEN_TAG_BLOCK_HEAD_CLOSE,
		BLOCK_FOOTER: TOKEN_TAG_BLOCK_FOOTER,
		SIGNIFIER: TOKEN_TAG_SIGNIFIER,
		COMMENT_CLOSE: TOKEN_TAG_COMMENT_CLOSE,
		RAW_CLOSE: TOKEN_TAG_RAW_CLOSE,
		PIPE: TOKEN_TAG_PIPE,
		AT: TOKEN_TAG_AT,
		STRING_LITERAL: TOKEN_TAG_STRING_LITERAL,
		SINGLE_QUOTE: TOKEN_TAG_SINGLE_QUOTE,
		DOUBLE_QUOTE: TOKEN_TAG_DOUBLE_QUOTE,
		OPERATOR: TOKEN_TAG_OPERATOR,
		GENERAL: TOKEN_GENERAL,
		WHITESPACE: TOKEN_TAG_WHITESPACE,
		TILDE: TOKEN_TAG_TILDE,

		process: process,



		Token: Token
	};

})(this,this.grips);

;


(function __grips_parser__(global,_Grips){

	/* Node */
	function Node(props) {
		for (var i in props) { if (props.hasOwnProperty(i)) {
			this[i] = props[i];
		}}
	}



	/* Parser */
	function nodify(tokens,collectionID) {
		function handleOutsideState(token) {
			if (token.type === _Grips.tokenizer.OPEN) {
				node = new Node({
					parent: null,
					type: null,
					token: token,
					def: [],
					children: [],
					complete: false
				});
				if (current_parent) {
					node.parent = current_parent;
					current_parent.children.push(node);
				}
				else {
					delete node.parent;
					nodes.push(node);
				}
				current_parent = node;
				instance_api.state = NODE_STATE_INSIDE;
			}
			else if (token.type === _Grips.tokenizer.GENERAL) {
				node = new Node({
					parent: null,
					type: NODE_TEXT,
					token: token,
					val: token.val,
					complete: true
				});
				if (current_parent) {
					node.parent = current_parent;
					current_parent.children.push(node);
				}
				else {
					delete node.parent;
					nodes.push(node);
				}
			}
			else if (current_parent && token.type === _Grips.tokenizer.WHITESPACE) {
				node = new Node({
					parent: current_parent,
					type: NODE_TEXT,
					token: token,
					val: token.val,
					complete: true
				});
				current_parent.children.push(node);
			}
			else if (token.type === _Grips.tokenizer.BLOCK_FOOTER) {
				if (current_parent && current_parent.close_header === _Grips.tokenizer.BLOCK_HEAD_CLOSE) {
					current_parent.complete = true;
					current_parent = current_parent.parent;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
		}

		function handleInsideState(token) {

			// check to see if we need to implicitly switch to EXPR processing
			function implicitlyStartExpr() {
				if (current_parent.type === NODE_TAG_INSERT_VAR ||
					current_parent.type === NODE_TAG_INCL_TMPL ||
					current_parent.type === NODE_TAG_LOOP ||
					current_parent.type === NODE_TAG_LET
				) {
					node = new Node({
						parent: current_parent,
						type: null,
						token: null,
						def: []
					});

					// main EXPR in a LOOP tag?
					if (!current_parent.main_expr &&
						current_parent.type === NODE_TAG_LOOP
					) {
						current_parent.main_expr = node;
						node.type = NODE_MAIN_REF_EXPR;
					}
					// main EXPR in an INCL tag?
					else if (current_parent.type === NODE_TAG_INSERT_VAR ||
						current_parent.type === NODE_TAG_INCL_TMPL
					) {
						if (!current_parent.main_expr) {
							current_parent.main_expr = node;
							node.type = NODE_MAIN_REF_EXPR;
							if (current_parent.type === NODE_TAG_INCL_TMPL) {
								node.collection_id = collectionID;
							}
						}
						else {
							instance_api.state = NODE_STATE_INVALID;
							return unknown_error;
						}
					}
					// otherwise, just an additional statement EXPR
					else {
						node.type = NODE_GENERAL_EXPR;
					}

					current_parent.def.push(node);
					current_parent = node;
				}
			}

			if (token.type === _Grips.tokenizer.SIGNIFIER) {
				if (current_parent && current_parent.type == null) {
					if (/^(?:\:|define)$/.test(token.val)) current_parent.type = NODE_TAG_DEFINE;
					else if (/^(?:\+|extend)$/.test(token.val)) current_parent.type = NODE_TAG_EXTEND;
					else if (/^(?:\=|insert|print)$/.test(token.val)) current_parent.type = NODE_TAG_INSERT_VAR; // NOTE: can later be re-defined to NODE_TAG_INCL_TMPL if `@` is found subsequently
					else if (/^partial$/.test(token.val)) current_parent.type = NODE_TAG_INCL_TMPL;
					else if (/^(?:\*|loop)$/.test(token.val)) current_parent.type = NODE_TAG_LOOP;
					else if (/^(?:#|let)$/.test(token.val)) current_parent.type = NODE_TAG_LET;
					else if (/^(?:\%|raw)$/.test(token.val)) current_parent.type = NODE_TAG_RAW;
					else if (/^(?:\/|comment)$/.test(token.val)) current_parent.type = NODE_TAG_COMMENT;
					else if (/^(?:escape|(?:~|escape\s+)[hsuHSU]*)$/.test(token.val)) current_parent.type = NODE_TAG_ESCAPE;

					// special handling for various tag types
					if (current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_INSERT_VAR
					) {
						current_parent.close_header = _Grips.tokenizer.SIMPLE_CLOSE;
						delete current_parent.children; // these tag types don't have `children`
					}
					else if (current_parent.type === NODE_TAG_INCL_TMPL) {
						current_parent.close_header = _Grips.tokenizer.SIMPLE_CLOSE;
					}
					else if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_TAG_LET
					) {
						current_parent.close_header = _Grips.tokenizer.BLOCK_HEAD_CLOSE;
					}
					else if (current_parent.type === NODE_TAG_ESCAPE) {
						current_parent.close_header = _Grips.tokenizer.BLOCK_HEAD_CLOSE;
						current_parent.escapes = {};
						if (/(?:~.*|escape\s+.*)h/i.test(token.val)) current_parent.escapes.html = true;
						if (/(?:~.*|escape\s+.*)s/i.test(token.val)) current_parent.escapes.string = true;
						if (/(?:~.*|escape\s+.*)u/i.test(token.val)) current_parent.escapes.url = true;
						if (!/\b[hsu]$/i.test(token.val)) current_parent.escapes.string = true;
						delete current_parent.def; // escape tags don't have a declaration
					}
					else if (current_parent.type === NODE_TAG_RAW) {
						current_parent.val = "";
						instance_api.state = NODE_STATE_RAW;
						delete current_parent.def; // raw tags don't have a declaration
						delete current_parent.children; // raw tags don't have `children`
					}
					else if (current_parent.type === NODE_TAG_COMMENT) {
						current_parent.val = "";
						instance_api.state = NODE_STATE_COMMENT;
						delete current_parent.def; // comment tags don't have a declaration
						delete current_parent.children; // comment tags don't have `children`
					}

					// invalid top-level tag?
					if ((
							!current_parent.parent &&
							!(
								current_parent.type === NODE_TAG_EXTEND ||
								current_parent.type === NODE_TAG_DEFINE ||
								current_parent.type === NODE_TAG_COMMENT
							)
						) ||
						// top-level-only tag invalidly nested?
						(
							current_parent.parent &&
							(
								current_parent.type === NODE_TAG_EXTEND ||
								current_parent.type === NODE_TAG_DEFINE
							)
						)
					) {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.WHITESPACE) {
				if (current_parent) {
					if (current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_INSERT_VAR ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_TAG_LET ||
						current_parent.type === NODE_TAG_ESCAPE ||
						current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						// is this node's declaration already in progress?
						if (current_parent.def &&
							current_parent.def.length > 0
						) {
							// keep the whitespace node (could be relevant)
							current_parent.def.push(new Node({
								parent: current_parent,
								type: NODE_WHITESPACE,
								token: token
							}));
						}
						// otherwise, ignore the whitespace node
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}
				}
				// NOTE: we ignore whitespace tokens if they're not inside a tag (parent)
			}
			// redefine insert as a template-include?
			else if (token.type === _Grips.tokenizer.AT) {
				if (current_parent &&
					current_parent.type === NODE_TAG_INSERT_VAR &&
					current_parent.def.length === 0 // is the node's declaration not yet defined?
				) {
					current_parent.type = NODE_TAG_INCL_TMPL;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.TILDE) {
				if (current_parent &&
					(
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_INSERT_VAR
					) &&
					current_parent.def.length === 0 // is the node's declaration not yet defined?
				) {
					current_parent.escapes = {};
					if (/h/i.test(token.val)) current_parent.escapes.html = true;
					if (/s/i.test(token.val)) current_parent.escapes.string = true;
					if (/u/i.test(token.val)) current_parent.escapes.url = true;
					if (!/[hsu]/i.test(token.val)) current_parent.escapes.string = true;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
			else if (
				token.type === _Grips.tokenizer.SINGLE_QUOTE ||
				token.type === _Grips.tokenizer.DOUBLE_QUOTE
			) {
				if (current_parent &&
					(
						current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					)
				) {
					instance_api.state = NODE_STATE_LITERAL;
					node = new Node({
						parent: current_parent,
						type: null,
						token: token,
						val: "",
						delimiter: token.val
					});

					if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_EXTEND
					) {
						if (!current_parent.id) {
							current_parent.id = node;
							node.type = NODE_ID;
							if (current_parent.type === NODE_TAG_DEFINE) {
								node.collection_id = collectionID;
							}
						}
						else {
							instance_api.state = NODE_STATE_INVALID;
							return unknown_error;
						}
					}
					else if (current_parent.type === NODE_TAG_INCL_TMPL) {
						if (!current_parent.main_expr) {
							current_parent.main_expr = node;
							node.type = NODE_ID;
							node.collection_id = collectionID;
						}
						else {
							instance_api.state = NODE_STATE_INVALID;
							return unknown_error;
						}
					}
					else {
						node.type = NODE_STRING_LITERAL;
					}

					current_parent.def.push(node);
					current_parent = node;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.OPERATOR) {
				if (current_parent) {
					// do we need to implicitly switch to EXPR processing for this tag?
					if (/[\(\[]/.test(token.val)) {
						implicitlyStartExpr();
					}

					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						// is the current EXPR missing its token?
						if (!current_parent.token) {
							current_parent.token = token;
						}
						if (token.val === "-" &&
							current_parent.def.length > 0
						) {
							if (current_parent.def[current_parent.def.length-1].type !== NODE_WHITESPACE &&
								!(
									current_parent.def[current_parent.def.length-1].type === NODE_OPERATOR &&
									/(?:\.\.)|\[/.test(current_parent.def[current_parent.def.length-1].val)
								)
							) {
								return unknown_error;
							}
						}

						current_parent.def.push(new Node({
							parent: current_parent,
							type: NODE_OPERATOR,
							token: token,
							val: token.val
						}));
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.PIPE) {
				if (current_parent) {
					// is this PIPE delimiting a previous EXPR node?
					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						if (current_parent.def.length === 0) {
							instance_api.state = NODE_STATE_INVALID;
							return unknown_error;
						}
						current_parent = current_parent.parent;
					}

					// is this PIPE coming too early in a LET Tag?
					if (current_parent.type === NODE_TAG_LET &&
						current_parent.def.length === 0
					) {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id &&
						(
							current_parent.type === NODE_TAG_DEFINE ||
							current_parent.type === NODE_TAG_EXTEND
						)
					) {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}

					if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_TAG_LET ||
						(
							current_parent.type === NODE_TAG_INCL_TMPL &&
							!current_parent.context_expr
						)
					) {
						node = new Node({
							parent: current_parent,
							type: NODE_GENERAL_EXPR,
							token: null,
							def: []
						});
						if (current_parent.type === NODE_TAG_INCL_TMPL) {
							current_parent.context_expr = node;
						}
						current_parent.def.push(node);
						current_parent = node;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.SIMPLE_CLOSE) {
				if (current_parent) {
					// do we need to close the current EXPR node?
					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id &&
						current_parent.type === NODE_TAG_EXTEND
					) {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}

					if (current_parent.close_header === _Grips.tokenizer.SIMPLE_CLOSE) {
						if (current_parent.type === NODE_TAG_INCL_TMPL &&
							!current_parent.context_expr
						) {
							node = new Node({
								parent: current_parent,
								type: NODE_GENERAL_EXPR,
								token: null,
								def: []
							});
							node.def.push(new Node({
								parent: node,
								type: NODE_TEXT,
								token: null,
								val: "$"
							}));
							current_parent.context_expr = node;
							current_parent.def.push(node);
						}

						current_parent.complete = true;
						instance_api.state = NODE_STATE_OUTSIDE;
						current_parent = current_parent.parent;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.BLOCK_HEAD_CLOSE) {
				if (current_parent) {
					// do we need to close the current EXPR node?
					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// LET Tag with no declarations?
					if (current_parent.type === NODE_TAG_LET &&
						current_parent.def.length === 0
					) {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id && current_parent.type === NODE_TAG_DEFINE) {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}

					if (current_parent.close_header === _Grips.tokenizer.BLOCK_HEAD_CLOSE) {
						instance_api.state = NODE_STATE_OUTSIDE;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
			else if (token.type === _Grips.tokenizer.GENERAL) {
				if (current_parent) {
					// do we need to implicitly switch to EXPR processing for this tag?
					implicitlyStartExpr();

					if (current_parent.type === NODE_GENERAL_EXPR ||
						current_parent.type === NODE_MAIN_REF_EXPR
					) {
						// is the current EXPR missing its token?
						if (!current_parent.token) {
							current_parent.token = token;
						}
						// do we need to negate a number because of a preceeding `-` operator?
						if (/^\d+$/.test(token.val) &&
							current_parent.def.length > 0 &&
							current_parent.def[current_parent.def.length-1].type === NODE_OPERATOR &&
							current_parent.def[current_parent.def.length-1].val === "-"
						) {
							current_parent.def[current_parent.def.length-1] = new Node({
								parent: current_parent,
								type: NODE_TEXT,
								token: new _Grips.tokenizer.Token({
									type: _Grips.tokenizer.GENERAL,
									val: "-" + token.val
								}),
								val: "-" + token.val
							});
						}
						else {
							current_parent.def.push(new Node({
								parent: current_parent,
								type: NODE_TEXT,
								token: token,
								val: token.val
							}));
						}
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return unknown_error;
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return unknown_error;
				}
			}
		}

		function handleRawState(token) {
			if (token.type === _Grips.tokenizer.GENERAL) {
				// if this raw node's token isn't yet assigned, this current token should be it
				if (current_parent.token.type !== _Grips.tokenizer.GENERAL) {
					current_parent.token = token;
				}

				current_parent.val += token.val;
			}
			else if (token.type === _Grips.tokenizer.RAW_CLOSE) {
				current_parent.complete = true;
				current_parent = current_parent.parent;
				instance_api.state = NODE_STATE_OUTSIDE;
			}
			else {
				return unknown_error;
			}
		}

		function handleCommentState(token) {
			if (token.type === _Grips.tokenizer.COMMENT_CLOSE) {
				current_parent = current_parent.parent;

				// discard the comment node once it's been fully processed
				if (current_parent) {
					current_parent.children.pop();
				}
				else {
					nodes.pop();
				}

				instance_api.state = NODE_STATE_OUTSIDE;
			}
		}

		function handleStringLiteralState(token) {
			if (token.type === _Grips.tokenizer.GENERAL) {
				// if this literal node's token isn't yet assigned, this current token should be it
				if (current_parent.token.type !== _Grips.tokenizer.GENERAL) {
					current_parent.token = token;
				}

				current_parent.val += token.val;
			}
			else if (
				(
					token.type === _Grips.tokenizer.SINGLE_QUOTE ||
					token.type === _Grips.tokenizer.DOUBLE_QUOTE
				) &&
				current_parent.delimiter === token.val
			) {
				current_parent = current_parent.parent;
				instance_api.state = NODE_STATE_INSIDE;
			}
			else {
				return unknown_error;
			}
		}


		var idx, node, res,
			state_handlers = [
				handleOutsideState,
				handleInsideState,
				handleRawState,
				handleCommentState,
				handleStringLiteralState
			]
		;

		// need to insert a start collectionID marker into the node stream?
		if (collectionID !== current_collection_id) {
			// need to close a current collectionID marker?
			if (current_collection_id) {
				nodes.push(new Node({
					type: NODE_COLLECTION_MARKER,
					close: current_collection_id,
					complete: true
				}));
			}

			current_collection_id = collectionID;

			nodes.push(new Node({
				type: NODE_COLLECTION_MARKER,
				start: collectionID,
				complete: true
			}));
		}

		// loop over the tokens
		for (idx=0; idx<tokens.length; idx++) {
			if (instance_api.state === NODE_STATE_INVALID) {
				return unknown_error;
			}

			// invoke the parser state handler
			res = state_handlers[instance_api.state](tokens[idx]);
			if (res) return res;
		}

		return true;
	}

	// ends the current collection stream
	function end() {
		if (current_collection_id) {
			nodes.push(new Node({
				type: NODE_COLLECTION_MARKER,
				close: current_collection_id,
				complete: true
			}));
		}
		current_collection_id = null;
	}

	function combineNodes(nodes) {
		var start, end, i, j;

		for (i=0; i<nodes.length; i++) {
			if (nodes[i].type === NODE_TEXT) {
				start = end = i;
				for (j=start+1; j<nodes.length; j++) {
					end = j;
					if (nodes[j].type !== NODE_TEXT) {
						end--;
						break;
					}
				}
				if (end > start) {
					for (j=start+1; j<=end; j++) {
						nodes[start].token.val += nodes[j].token.val;
						nodes[start].val += nodes[j].val;
					}
					nodes.splice(start+1,end-start);
				}
				else i = j;
			}
		}

		return combineWhitespaceNodes(nodes);
	}

	function combineWhitespaceNodes(nodes) {
		var start, end, i, j;

		for (i=0; i<nodes.length; i++) {
			if (nodes[i].type === NODE_WHITESPACE) {
				start = end = i;
				for (j=start+1; j<nodes.length; j++) {
					end = j;
					if (nodes[j].type !== NODE_WHITESPACE) {
						end--;
						break;
					}
				}
				if (end > start) {
					for (j=start+1; j<=end; j++) {
						nodes[start].token.val += nodes[j].token.val;
						nodes[start].val += nodes[j].val;
					}
					nodes.splice(start+1,end-start);
				}
				else i = j;
			}
		}

		return nodes;
	}

	function stripWhitespace(nodes) {
		var ret = [], i = 0, j = nodes.length - 1;

		while (i<=j) {
			if (nodes[i].type === NODE_WHITESPACE) i++;
			if (nodes[j].type === NODE_WHITESPACE) j--;
			if (!(
				i < j &&
				(
					nodes[i].type === NODE_WHITESPACE ||
					nodes[j].type === NODE_WHITESPACE
				)
			)) {
				break;
			}
		}

		if (i<=j) {
			ret = nodes.slice(i,j+1);
		}

		return ret;
	}

	function stripOuterGroupings(nodes) {
		var ret = [], i = 0, j = nodes.length - 1, k, level = 0;

		while (i<j) {
			if (nodes[i].type === NODE_WHITESPACE) i++;
			if (nodes[j].type === NODE_WHITESPACE) j--;
			if (i < j &&
				nodes[i].type !== NODE_WHITESPACE &&
				nodes[j].type !== NODE_WHITESPACE
			) {
				if (nodes[i].type === NODE_OPERATOR &&
					nodes[i].val === "(" &&
					nodes[j].type === NODE_OPERATOR &&
					nodes[j].val === ")"
				) {
					for (k=i+1; k<j; k++) {
						if (nodes[k].type === NODE_OPERATOR) {
							if (nodes[k].val === "(") {
								level++;
							}
							else if (nodes[k].val === ")") {
								level--;
							}
							if (level < 0) {
								break;
							}
						}
					}
					if (level === 0) {
						i++;
						j--;
					}
					else {
						break;
					}
				}
				else {
					break;
				}
			}
		}

		if (i<=j) {
			ret = nodes.slice(i,j+1);
		}

		return ret;
	}

	function discardOperators(nodes) {
		for (var i=0; i<nodes.length; i++) {
			if (nodes[i].type === NODE_OPERATOR) {
				nodes.splice(i,1);
				i--;
			}
		}
	}

	function parse(node) {

		function identifyBracketLiteral(nodes) {
			var i, node, literal = [], special_operator_found = false;
			if (nodes.length < 5) return false;

			if (!(
					nodes[0].type === NODE_OPERATOR &&
					nodes[0].val === "["
				)
			) {
				return false;
			}

			literal.push(nodes[0]);

			for (i=1; i<nodes.length; i++) {
				node = nodes[i];
				if (node.type === NODE_WHITESPACE) {
					continue;
				}

				literal.push(node);

				if (node.type === NODE_OPERATOR) {
					if (node.val === "]") {
						break;
					}
					else if (!/(?:\.\.)|[\-,]/.test(node.val)) {
						return false;
					}
					else if (/(?:\.\.)|,/.test(node.val)) {
						special_operator_found = true;
					}
				}
			}

			if (literal.length < 5 ||
				!special_operator_found
			) {
				return false;
			}

			return literal;
		}

		function identifyConditionalExpr(nodes) {
			function processExpr(def,type,validateFn) {
				var expr, i;

				def = stripOuterGroupings(def);

				expr = new Node({
					parent: conditional_expr,
					type: type,
					token: def[0].token,
					def: def
				});

				err = validateFn(expr);
				// is the expression invalid?
				if (err) {
					return err;
				}

				// remap `parent`s
				for (i=0; i<expr.def.length; i++) {
					expr.def[i].parent = expr;
				}

				return expr;
			}

			var i, node, def = [], tmp,
				conditional_expr, test_expr, then_expr, else_expr
			;

			if (nodes.length > 0) {
				for (i=0; i<nodes.length; i++) {
					node = nodes[i];

					if (node.type === NODE_OPERATOR &&
						/[?:]/.test(node.val)
					) {
						if (node.val === "?") {
							if (!conditional_expr) {
								conditional_expr = new Node({
									parent: null,
									type: NODE_CONDITIONAL_EXPR,
									token: nodes[0].token,
									def: []
								});

								test_expr = processExpr(def,NODE_BOOLEAN_EXPR,validateRHExpr);
								// invalid `test` expression?
								if (test_expr instanceof Error) {
									throw test_expr;
								}

								// setup default empty else expression
								else_expr = new Node({
									parent: conditional_expr,
									type: NODE_VAL_EXPR,
									token: null,
									def: []
								});
								tmp = new Node({
									parent: else_expr,
									type: NODE_STRING_LITERAL,
									token: null,
									val: "",
									delimiter: "\""
								});
								else_expr.def.push(tmp);

								def = [];
							}
							// otherwise, this is an illegal nested conditional
							else {
								return false; // bail
							}
						}
						else if (node.val === ":") {
							if (conditional_expr && !then_expr) {
								then_expr = processExpr(def,NODE_VAL_EXPR,validateValueExpr);
								// invalid `then` expression?
								if (then_expr instanceof Error) {
									throw then_expr;
								}

								def = [];
							}
							// otherwise, this is an invalid expression, or an illegal nested conditional
							else {
								return false; // bail
							}
						}
					}
					else {
						def.push(node);
					}
				}

				if (def.length > 0) {
					if (conditional_expr) {
						if (!then_expr) {
							then_expr = processExpr(def,NODE_VAL_EXPR,validateValueExpr);
							// invalid `then` expression?
							if (then_expr instanceof Error) {
								throw then_expr;
							}
						}
						else {
							else_expr = processExpr(def,NODE_VAL_EXPR,validateValueExpr);
							// invalid `else` expression?
							if (else_expr instanceof Error) {
								throw else_expr;
							}
						}

						def = [];
					}
					// didn't find a conditional
					else {
						return false; // bail
					}
				}

				if (test_expr && then_expr) {
					conditional_expr.def.push(test_expr,then_expr,else_expr);
					return conditional_expr;
				}
			}
		}

		function validateTagID(id) {
			var tmp;
			if ((tmp = id.val.match(/#/g)) && tmp.length > 1) {
				return unknown_error;
			}
			else if (id.parent.type === NODE_TAG_DEFINE) {
				if (!id.val) {
					return unknown_error;
				}
				else if (!/^#/.test(id.val)) {
					return unknown_error;
				}
				else if (!/^#[a-z0-9_\-$.+=\/]/i.test(id.val)) {
					return unknown_error;
				}
				else if ((tmp = id.val.match(/(#.*?)([^a-z0-9_\-$.+=\/]).*$/i))) {
					return unknown_error;
				}
				// need to add the collectionID to the Define Tag ID
				else {
					id.val = id.collection_id + id.val;
				}
			}
			else if (id.parent.type === NODE_TAG_EXTEND) {
				if ((tmp = id.val.match(/#/))) {
					return unknown_error;
				}
			}
			else if (id.parent.type === NODE_TAG_INCL_TMPL) {
				if (!(
						id.val &&
						/#.+/.test(id.val)
					)
				) {
					return unknown_error;
				}
				else if ((tmp = id.val.match(/(#.*?)([^a-z0-9_\-$.+=\/]).*$/i))) {
					return unknown_error;
				}
			}
		}

		function validateRHExpr(expr) {
			function inLoopScope(node) {
				while (node.parent && (node = node.parent)) {
					if (node.type === _Grips.parser.TAG_LOOP) {
						return true;
					}
				}
				return false;
			}

			function inMainRef(node) {
				while (node.parent && (node = node.parent)) {
					if (node.type === _Grips.parser.MAIN_REF_EXPR ||
						node.type === _Grips.parser.ASSIGNMENT_EXPR
					) {
						return (node.type === _Grips.parser.MAIN_REF_EXPR);
					}
				}
				return false;
			}

			var i, tmp, prev_node, node, stack = [];
			if (expr.def && expr.def.length > 0) {
				for (i=0; i<expr.def.length; i++) {
					// ignore whitespace in simple expressions
					if (expr.def[i].type === NODE_WHITESPACE) {
						continue;
					}

					prev_node = node;
					node = expr.def[i];

					if (node.type === NODE_OPERATOR) {
						// check for invalid simple expression operators
						if (!/[.!\[\]\(\)]/.test(node.val)) {
							return unknown_error;
						}

						// check for valid trailing operator
						if (i === (expr.def.length-1) &&
							!/[\]\)]/.test(node.val)
						) {
							return unknown_error;
						}

						// check for valid operator following previous token
						if (prev_node) {
							// are there two operators in a row?
							if (prev_node.type === NODE_OPERATOR) {
								if (node.val === "(" &&
									!/[!\(\[]/.test(prev_node.val)
								) {
									return unknown_error;
								}
								else if (node.val === "!" &&
									!/[!\(]/.test(prev_node.val)
								) {
									return unknown_error;
								}
								else if (/[.\[\]\)]/.test(node.val) &&
									!/[\]\)]/.test(prev_node.val)
								) {
									return unknown_error;
								}
							}
							else if (prev_node.type === NODE_TEXT &&
								!/[.\[\]\)]/.test(node.val)
							) {
								return unknown_error;
							}
							else if (prev_node.type === NODE_STRING_LITERAL &&
								!/[\]\)]/.test(node.val)
							) {
								return unknown_error;
							}
						}
						else if (!/[!\(]/.test(node.val)) {
							return unknown_error;
						}

						// check [] () balance
						if (/[\[\(]/.test(node.val)) {
							stack.push(node.val);
						}
						else if (/[\]\)]/.test(node.val)) {
							// are we balanced with a matching `(` or `[`?
							if (stack.length > 0 &&
								(
									(stack[stack.length-1] === "[" && node.val === "]") ||
									(stack[stack.length-1] === "(" && node.val === ")")
								)
							) {
								stack.pop();
							}
							else {
								return unknown_error;
							}
						}
					}
					else if (node.type === NODE_TEXT) {
						if (/^\d/.test(node.val)) {
							if (!/^\d+$/.test(node.val)) {
								return unknown_error;
							}
							else if (prev_node &&
								!(
									prev_node.type === NODE_OPERATOR &&
									/[\(\[]/.test(prev_node.val)
								)
							) {
								return unknown_error;
							}
						}
						tmp = inMainRef(node);
						if (expr.def.length === 1) {
							if (node.val === "_" &&
								!(
									tmp ||
									(node.parent.parent.context_expr === node.parent)
								)
							) {
								return unknown_error;
							}
						}
						if (node.val === "_" &&
							!(
								(
									tmp &&
									inLoopScope(node.parent.parent)
								) ||
								(
									!tmp &&
									inLoopScope(node)
								)
							)
						) {
							return unknown_error;
						}
						if (prev_node) {
							if (prev_node.type === NODE_TEXT) {
								return unknown_error;
							}
							else if (prev_node.type === NODE_OPERATOR &&
								!/[.!\(\[]/.test(prev_node.val)
							) {
								return unknown_error;
							}
						}
					}
					else if (node.type === NODE_STRING_LITERAL) {
						if (prev_node &&
							!(
								prev_node.type === NODE_OPERATOR &&
								/[\[\(]/.test(prev_node.val)
							)
						) {
							return unknown_error;
						}
					}
				}
				if (stack.length > 0) {
					return unknown_error;
				}
			}
			else {
				return unknown_error;
			}
		}

		function validateRangeExpr(expr) {
			if (expr.def && expr.def.length === 5) {
				if (!(
						expr.def[1].type === NODE_TEXT &&
						/^-?\d+$/.test(expr.def[1].val)
					)
				) {
					return unknown_error;
				}
				else if (!(
						expr.def[3].type === NODE_TEXT &&
						/^-?\d+$/.test(expr.def[3].val)
					)
				) {
					return unknown_error;
				}
				else if (!(
						expr.def[2].type === NODE_OPERATOR &&
						expr.def[2].val === ".."
					)
				) {
					return unknown_error;
				}
			}
			else {
				return unknown_error;
			}
		}

		function validateSetExpr(expr) {
			var i, prev_node, node;
			if (expr.def && expr.def.length >= 5) {
				for (i=1; i<expr.def.length-1; i++) {
					prev_node = node;
					node = expr.def[i];

					if (node.type === NODE_STRING_LITERAL) {
						if (prev_node &&
							!(
								prev_node.type === NODE_OPERATOR &&
								prev_node.val === ","
							)
						) {
							return unknown_error;
						}
					}
					else if (node.type === NODE_OPERATOR &&
						node.val === ","
					) {
						if (!(
								prev_node &&
								prev_node.type === NODE_STRING_LITERAL
							)
						) {
							return unknown_error;
						}
					}
					else {
						return unknown_error;
					}
				}
				if (expr.def[expr.def.length-2].type !== NODE_STRING_LITERAL) {
					return unknown_error;
				}
			}
			else {
				return unknown_error;
			}
		}

		function validateAssignmentExpr(expr) {
			var i, j, prev_node, node, tmp, tmp2, def = [],
				lh_expr, rh_expr
			;

			if (expr.def && expr.def.length > 0) {
				for (i=0; i<expr.def.length; i++) {
					// ignore whitespace in simple expressions
					if (expr.def[i].type === NODE_WHITESPACE) {
						continue;
					}

					prev_node = node;
					node = expr.def[i];

					// handling LH of assignment statement?
					if (!lh_expr) {
						if (node.type === NODE_OPERATOR) {
							if (node.val === "=") {
								lh_expr = new Node({
									parent: expr,
									type: NODE_REF_EXPR,
									token: def[0].token,
									def: def
								});

								// is this NOT a special set-literal ref expression?
								if (!(
										def[0] &&
										def[0].type === NODE_REF_EXPR &&
										def[1] &&
										(
											def[1].type === NODE_SET_LITERAL ||
											def[1].type === NODE_RANGE_LITERAL
										)
									)
								) {
									// validate the regular ref expression
									err = validateRefExpr(lh_expr);
									if (err) {
										return err;
									}
								}

								// remap `parent`s
								for (j=0; j<lh_expr.def.length; j++) {
									lh_expr.def[j].parent = lh_expr;
								}

								def = [];
							}
							else if (node.val === "[") {
								// are we starting a bracket-literal (which needs special handling)?
								tmp = identifyBracketLiteral(expr.def.slice(i));
								if (tmp) {
									tmp2 = new Node({
										parent: null,
										type: NODE_REF_EXPR,
										token: expr.def[0].token,
										def: expr.def.slice(0,i)
									});
									err = validateRefExpr(tmp2);
									// is the preceeding expression a valid ref expression?
									if (!err) {
										def = [tmp2];

										tmp2 = new Node({
											parent: null,
											type: NODE_RANGE_LITERAL,
											token: node.token,
											def: tmp
										});

										err = validateRangeExpr(tmp2);
										// not a valid set-literal?
										if (err) {
											tmp2.type = NODE_SET_LITERAL;
											err = validateSetExpr(tmp2);
										}

										// valid bracket-literal?
										if (!err) {
											def.push(tmp2);

											// set up loop index for next iteration
											i += (tmp.length - 1);

											// remove operators from the bracket-literal
											discardOperators(tmp2.def);
										}
										else {
											err = unknown_error;
										}
									}

									if (err) {
										return err;
									}
								}
								// otherwise just keep processing the expression nodes
								else {
									def.push(node);
								}
							}
							else if (!(
									prev_node &&
									/[.\[\]]/.test(node.val)
								)
							) {
								return unknown_error;
							}
							else {
								def.push(node);
							}
						}
						else {
							def.push(node);
						}
					}
					// otherwise, handle RH of assignment statement
					else {
						tmp = stripOuterGroupings(expr.def.slice(i));

						if (tmp.length === 0) {
							return unknown_error;
						}

						// setup the RH expression node
						rh_expr = new Node({
							parent: expr,
							type: NODE_VAL_EXPR,
							token: tmp[0].token,
							def: []
						});

						tmp2 = identifyConditionalExpr(tmp);

						// was the RH expr NOT a conditional?
						if (!tmp2) {
							rh_expr.def = tmp;

							err = validateValueExpr(rh_expr);
							if (err) {
								return err;
							}
						}
						// was a valid conditional
						else {
							rh_expr.def = [tmp2];
						}

						// remap `parent`s
						for (j=0; j<rh_expr.def.length; j++) {
							rh_expr.def[j].parent = rh_expr;
						}

						break;
					}
				}

				if (lh_expr && rh_expr) {
					lh_expr.def = stripWhitespace(lh_expr.def);
					rh_expr.def = stripWhitespace(rh_expr.def);

					// update original node with statement's parsed structure
					expr.def = [lh_expr,rh_expr];
					expr.type = NODE_ASSIGNMENT_EXPR;
				}
				else return unknown_error;
			}
			else {
				return unknown_error;
			}
		}

		function validateValueExpr(expr) {
			var i, node, ret, identifier_found = false;
			if (expr.def && expr.def.length > 0) {
				for (i=0; i<expr.def.length; i++) {
					node = expr.def[i];
					if (node.type === NODE_OPERATOR) {
						if (node.val === "!") {
							return unknown_error;
						}
					}
					else if (node.type === NODE_TEXT) {
						if (!/^\d+$/.test(node.val)) {
							identifier_found = true;
						}
						else if (!identifier_found) {
							return unknown_error;
						}
					}
				}
			}
			else {
				return unknown_error;
			}

			ret = validateRHExpr(expr);
			if (ret) return ret;
		}

		function validateRefExpr(expr) {
			var i, prev_node, node, ret;
			if (expr.def && expr.def.length > 0) {
				for (i=0; i<expr.def.length; i++) {
					// ignore whitespace in simple expressions
					if (expr.def[i].type === NODE_WHITESPACE) {
						continue;
					}

					prev_node = node;
					node = expr.def[i];

					if (node.type === NODE_STRING_LITERAL &&
						!(
							prev_node &&
							prev_node.type === NODE_OPERATOR &&
							prev_node.val === "["
						)
					) {
						return unknown_error;
					}
				}
			}
			else {
				return unknown_error;
			}

			ret = validateValueExpr(expr);
			if (ret) return ret;
		}


		var ret, ret2, ret3, err, i;

		if (node.type === NODE_TAG_EXTEND) {
			if (!(node.id && (ret = parse(node.id)))) {
				throw unknown_error;
			}
			node.id = ret;

			// is there any non-whitespace left in the Tag declaration?
			if (node.def && node.def.length > 0) {
				node.def[0] = node.id;

				if (node.def.length > 1) {
					for (i=1; i<node.def.length; i++) {
						if (node.def[i].type !== NODE_WHITESPACE) {
							throw unknown_error;
						}
					}

					node.def = [node.id];
				}
			}

			return node;
		}
		else if (node.type === NODE_TAG_DEFINE) {
			if (!(node.id && (ret = parse(node.id)))) {
				throw unknown_error;
			}
			node.id = ret;

			// do we need to parse the Tag's declaration?
			if (node.def && node.def.length > 0) {
				ret = [node.id];
				ret3 = stripWhitespace(node.def.slice(1));
				for (i=0; i<ret3.length; i++) {
					ret2 = parse(ret3[i]);
					if (ret2) ret.push(ret2);
				}
				node.def = ret;
			}

			// do we need to parse the Tag's children?
			if (node.children && node.children.length > 0) {
				node.children = combineNodes(node.children);
				ret = [];
				for (i=0; i<node.children.length; i++) {
					ret2 = parse(node.children[i]);
					if (ret2) ret.push(ret2);
				}
				node.children = combineNodes(ret);
			}

			return node;
		}
		else if (node.type === NODE_TAG_LOOP) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw unknown_error;
			}
			node.main_expr = ret;

			// do we need to parse the Tag's declaration?
			if (node.def && node.def.length > 0) {
				ret = [node.main_expr];
				ret3 = stripWhitespace(node.def.slice(1));
				for (i=0; i<ret3.length; i++) {
					ret2 = parse(ret3[i]);
					if (ret2) ret.push(ret2);
				}
				node.def = ret;
			}

			// do we need to parse the Tag's children?
			if (node.children && node.children.length > 0) {
				node.children = combineNodes(node.children);
				ret = [];
				for (i=0; i<node.children.length; i++) {
					ret2 = parse(node.children[i]);
					if (ret2) ret.push(ret2);
				}
				node.children = combineNodes(ret);
			}

			return node;
		}
		else if (node.type === NODE_TAG_LET) {
			// parse the Tag's declaration
			if (node.def && node.def.length > 0) {
				ret = stripWhitespace(node.def);
				for (i=0; i<ret.length; i++) {
					ret2 = parse(ret[i]);
					if (ret2) ret[i] = ret2;
				}
				node.def = ret;
			}
			else {
				throw unknown_error;
			}

			// do we need to parse the Tag's children?
			if (node.children && node.children.length > 0) {
				node.children = combineNodes(node.children);
				ret = [];
				for (i=0; i<node.children.length; i++) {
					ret2 = parse(node.children[i]);
					if (ret2) ret.push(ret2);
				}
				node.children = combineNodes(ret);
			}

			return node;
		}
		else if (node.type === NODE_TAG_INSERT_VAR) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw unknown_error;
			}
			node.main_expr = ret;

			// besides the main EXPR, is there any non-whitespace left in the Tag declaration?
			if (node.def && node.def.length > 0) {
				if (node.def.length > 1) {
					for (i=1; i<node.def.length; i++) {
						if (node.def[i].type !== NODE_WHITESPACE) {
							throw unknown_error;
						}
					}
				}

				node.def = [node.main_expr];
			}

			return node;
		}
		else if (node.type === NODE_TAG_INCL_TMPL) {
			if (!(node.main_expr && (ret = parse(node.main_expr)))) {
				throw unknown_error;
			}
			node.main_expr = ret;

			node.context_expr.type = NODE_REF_EXPR;
			node.context_expr.def = stripWhitespace(node.context_expr.def);
			err = validateValueExpr(node.context_expr);
			if (err) {
				throw err;
			}

			node.def = [node.main_expr,node.context_expr];

			return node;
		}
		else if (node.type === NODE_TAG_RAW) {
			node.type = NODE_TEXT;

			return node;
		}
		else if (node.type === NODE_ID) {
			if ((err = validateTagID(node))) {
				throw err;
			}

			return node;
		}
		else if (node.type === NODE_GENERAL_EXPR) {
			if (node.def && node.def.length > 0) {
				node.def = combineWhitespaceNodes(node.def);
				node.def = stripWhitespace(node.def);

				err = validateAssignmentExpr(node);
				if (err) {
					throw err;
				}
			}
			else {
				throw unknown_error;
			}

			return node;
		}
		else if (node.type === NODE_MAIN_REF_EXPR) {
			if (node.def && node.def.length > 0) {
				// remove all whitespace from a main expr
				ret = [];
				for (i=0; i<node.def.length; i++) {
					if (node.def[i].type !== NODE_WHITESPACE) {
						ret.push(node.def[i]);
					}
				}
				node.def = stripOuterGroupings(ret);

				// can we infer that this expression is a bracket literal type?
				if ((ret = identifyBracketLiteral(node.def)) &&
					ret.length === node.def.length
				) {
					ret = new Node({
						parent: node,
						type: null,
						token: node.token,
						def: ret
					});
					// remap `parent`s
					for (i=0; i<ret.def.length; i++) {
						ret.def[i].parent = ret;
					}

					err = validateRangeExpr(node);
					if (!err) {
						ret.type = NODE_RANGE_LITERAL;
					}
					else {
						err = validateSetExpr(node);
						if (!err) {
							ret.type = NODE_SET_LITERAL;
						}
					}

					if (err) {
						throw unknown_error;
					}
					else {
						// remove operators from the bracket-literal
						discardOperators(ret.def);

						node.def = [ret];
					}
				}
				else if (node.parent.type === NODE_TAG_INSERT_VAR ||
					node.parent.type === NODE_TAG_LOOP
				) {
					err = validateRefExpr(node);
				}
				else if (node.parent.type === NODE_TAG_INCL_TMPL) {
					err = validateValueExpr(node);
				}

				if (err) {
					throw err;
				}
			}
			else {
				throw unknown_error;
			}

			return node;
		}
		else if (node.type === NODE_TEXT) {
			if (!node.parent && node.token.type !== _Grips.tokenizer.WHITESPACE) {
				throw unknown_error;
			}
			if (node.val !== "") {
				return node;
			}
		}
		else if (node.type === NODE_COLLECTION_MARKER) {
			if (node.start) {
				current_collection_id = node.start;
			}
			else if (node.close) {
				current_collection_id = null;
			}
			return node;
		}
		else {
			return node;
		}
	}

	function parseNextNode() {
		var ret;
		// go until we find a node that parsed well, or we run out of nodes
		while (node_idx < nodes.length && !ret && nodes[node_idx].complete) {
			ret = parse(nodes[node_idx++]);
		}
		return ret;
	}


	var nodes = [],
		current_parent,
		current_collection_id = "",
		node_idx = 0,

		NODE_STATE_OUTSIDE = 0,
		NODE_STATE_INSIDE = 1,
		NODE_STATE_RAW = 2,
		NODE_STATE_COMMENT = 3,
		NODE_STATE_LITERAL = 4,
		NODE_STATE_INVALID = 5,

		NODE_TEXT = 0,
		NODE_TAG_EXTEND = 1,
		NODE_TAG_DEFINE = 2,
		NODE_TAG_INCL_TMPL = 3,
		NODE_TAG_INSERT_VAR = 4,
		NODE_TAG_LOOP = 5,
		NODE_TAG_RAW = 6,
		NODE_TAG_COMMENT = 7,
		NODE_ID = 8,
		NODE_MAIN_REF_EXPR = 9,
		NODE_GENERAL_EXPR = 10,
		NODE_ASSIGNMENT_EXPR = 11,
		NODE_REF_EXPR = 12,
		NODE_VAL_EXPR = 13,
		NODE_CONDITIONAL_EXPR = 14,
		NODE_BOOLEAN_EXPR = 15,
		NODE_STRING_LITERAL = 16,
		NODE_RANGE_LITERAL = 17,
		NODE_SET_LITERAL = 18,
		NODE_WHITESPACE = 19,
		NODE_OPERATOR = 20,
		NODE_COLLECTION_MARKER = 21,
		NODE_TAG_ESCAPE = 22,
		NODE_TAG_LET = 23,

		instance_api,

		unknown_error = new Error("Unknown error")
	;

	instance_api = {
		OUTSIDE: NODE_STATE_OUTSIDE,
		INSIDE: NODE_STATE_INSIDE,
		RAW: NODE_STATE_RAW,
		COMMENT: NODE_STATE_COMMENT,
		LITERAL: NODE_STATE_LITERAL,
		INVALID: NODE_STATE_INVALID,

		TEXT: NODE_TEXT,
		TAG_EXTEND: NODE_TAG_EXTEND,
		TAG_DEFINE: NODE_TAG_DEFINE,
		TAG_INCL_TMPL: NODE_TAG_INCL_TMPL,
		TAG_INSERT_VAR: NODE_TAG_INSERT_VAR,
		TAG_LOOP: NODE_TAG_LOOP,
		TAG_RAW: NODE_TAG_RAW,
		TAG_COMMENT: NODE_TAG_COMMENT,
		ID: NODE_ID,
		MAIN_REF_EXPR: NODE_MAIN_REF_EXPR,
		GENERAL_EXPR: NODE_GENERAL_EXPR,
		ASSIGNMENT_EXPR: NODE_ASSIGNMENT_EXPR,
		REF_EXPR: NODE_REF_EXPR,
		VAL_EXPR: NODE_VAL_EXPR,
		CONDITIONAL_EXPR: NODE_CONDITIONAL_EXPR,
		BOOLEAN_EXPR: NODE_BOOLEAN_EXPR,
		STRING_LITERAL: NODE_STRING_LITERAL,
		RANGE_LITERAL: NODE_RANGE_LITERAL,
		SET_LITERAL: NODE_SET_LITERAL,
		WHITESPACE: NODE_WHITESPACE,
		OPERATOR: NODE_OPERATOR,
		COLLECTION_MARKER: NODE_COLLECTION_MARKER,
		TAG_ESCAPE: NODE_TAG_ESCAPE,
		TAG_LET: NODE_TAG_LET,

		state: NODE_STATE_OUTSIDE,

		nodify: nodify,
		end: end,
		parseNextNode: parseNextNode,

		
		Node: Node
	};

	_Grips.parser = instance_api;

})(this,this.grips);

;


(function __grips_generator__(global,_Grips){

	// From: https://gist.github.com/3667624
	function escapeDoubleQuotes(str) {
		return str.replace(/\\([\s\S])|(")/g,"\\$1$2"); // thanks @slevithan!
	}

	function escapeNewlines(str) {
		return str.replace(/\n/g,"\\n").replace(/\r/g,"\\r");
	}

	function escapeEscapes(str) {
		return str.replace(/\\(?!\\*\")/g,"\\\\");
	}



	function collectionDependencies() {
		var code = "";
		if (needs.sort)	code += "function __sort_fn__(a,b){ return a-b; }";
		code += "var partial = G.definePartial, clone = G.cloneObj";

		if (needs.extend) code += ", extend = G.extend";
		if (needs.esc) code += ", esc = G.strEscapes";
		if (needs.unerr) code += ", unerr = new Error(\"Unknown error\")";
		if (needs.RLH) code += ", RLH = G.RangeLiteralHash";
		if (needs.cID) code += ", cID = \"" + needs.cID_value + "\"";
		code += ";";

		return code;
	}

	function startCollection(node) {
		var code = "";
		code += "(function"  + "(G){";
			code += "/*startCollection*/";	// NOTE: this will get replaced later by whatever the dependencies are for this collection
		return code;
	}

	function closeCollection() {
		return "})(this.grips||grips);";
	}

	function conditional(node) {
		return expr(node.def[0]) + " ? " + expr(node.def[1]) + " : " + expr(node.def[2]);
	}

	function string_literal(node) {
		return node.delimiter + node.val + node.delimiter;
	}

	function range_literal(node) {
		var code = "";

		code += "for (i=" + node.def[0].val + "; i";
		if (node.def[0].val <= node.def[1].val) {
			code += "<=" + node.def[1].val + "; i++) {";
		}
		else {
			code += ">=" + node.def[1].val + "; i--) {";
		}

		return code;
	}

	function set_literal(node) {
		var i, code = "", def, tmp;

		tmp = "";
		for (i=0; i<node.def.length; i++) {
			def = node.def[i];
			tmp += (tmp !== "" ? "," : "") + string_literal(def);
		}
		code += "var _set = [" + tmp + "];";
		code += "for (i=0; i<" + node.def.length + "; i++) {";

		return code;
	}

	function expr(node) {
		var i, code = "", def, prev_def;

		if (node.type === _Grips.parser.STRING_LITERAL ||
			node.type === _Grips.parser.ID
		) {
			code += string_literal(node);
		}
		else if (node.def && node.def.length > 0) {
			if (node.def[0].type === _Grips.parser.CONDITIONAL_EXPR) {
				code += conditional(node.def[0]);
			}
			else {
				for (i=0; i<node.def.length; i++) {
					prev_def = def;
					def = node.def[i];
					if (def.type === _Grips.parser.TEXT) {
						if (!(
								def.val.match(/^\d+$/) ||
								def.val.match(/^[_\$](?=(?:[^a-z0-9_$]|$))/i) ||
								(
									prev_def &&
									prev_def.type === _Grips.parser.OPERATOR &&
									prev_def.val === "."
								)
							)
						) {
							code += "$$.";
						}
						code += def.val;
					}
					else if (def.type === _Grips.parser.OPERATOR) {
						code += def.val;
					}
					else if (def.type === _Grips.parser.STRING_LITERAL) {
						code += string_literal(def);
					}
				}
			}
		}
		else {
			throw  unknown_error;
		}

		return code;
	}

	function assignmentRangeLiteral(node) {
		var code = "", def, tmp;

		def = node.def[0];
		tmp = expr(def.def[0]);

		code += tmp + " = new RLH();";
		code += range_literal(def.def[1]);

		def = node.def[1].def[0];

		code += tmp + "[\"\" + i] = (" + expr(def.def[0]) + " === i) ? ";
		code += expr(def.def[1]) + " : " + expr(def.def[2]) + ";";
		code += "}";

		needs.RLH = true;	// update collection dependencies list

		return code;
	}

	function assignmentSetLiteral(node) {
		var code = "", def, tmp;

		def = node.def[0];
		tmp = expr(def.def[0]);

		code += tmp + " = {};";
		code += set_literal(def.def[1]);

		def = node.def[1].def[0];

		code += tmp + "[_set[i]] = (" + expr(def.def[0]) + " === _set[i]) ? ";
		code += expr(def.def[1]) + " : " + expr(def.def[2]) + ";";
		code += "}";

		return code;
	}

	function assignment(node) {
		var code = "", def;

		def = node.def[0];
		if (def.def[def.def.length-1].type === _Grips.parser.RANGE_LITERAL) {
			code += assignmentRangeLiteral(node);
		}
		else if (def.def[def.def.length-1].type === _Grips.parser.SET_LITERAL) {
			code += assignmentSetLiteral(node);
		}
		else {
			code += expr(def);
			code += " =";
			code += expr(node.def[1]);
			code += ";";
		}

		return code;
	}

	function tagExtend(node) {
		needs.extend = true;	// update collection dependencies list
		needs.cID = true;	// update collection dependencies list

		return "extend(cID,\"" + node.id.val + "\");";
	}

	function tagDefine(node) {
		var i, code = "", def;

		code += "partial(function"  + "($,$$){";
		code += "$$ = clone($$) || {};";
		code += "var i, ret = \"\", ret2, _;";

		for (i=1; i<node.def.length; i++) {
			def = node.def[i];

			code += assignment(def);

		}

		code += children(node);
		code += "return ret;";
		code += "},\"" + node.id.val + "\"";

		code += ");";
		return code;
	}

	function tagEscape(node) {
		var code = "";

		code += "ret2 = esc((function"  + "(){";
		code += "var ret = \"\", ret2;";
		code += children(node);
		code += "return ret;";
		code += "})()," + JSON.stringify(node.escapes) + ");";
		code += templateErrorGuard("ret","ret2");

		needs.esc = true;	// update collection dependencies list
		return code;
	}

	function tagLoop(node) {
		var i, code = "", def;

		code += "ret2 = (function"  + "(){";
		code += "function __iter__($,$$,value,key,index){";
			code += "var i, ret = \"\", ret2, _;";
			code += "if (value == null) return ret;";
			code += "$$ = clone($$);";
			code += "_ = {";
				code += "value: value,";
				code += "key: key,";
				code += "index: index,";
				code += "even: (index % 2) === 0,";
				code += "odd: (index % 2) === 1,";
				code += "first: (index === 0),";
				code += "last: (index === len - 1)";
			code += "};";
		for (i=1; i<node.def.length; i++) {
			def = node.def[i];

			code += assignment(def);

		}
		code += children(node);
		code += "return ret;";
		code += "}";
		code += "var i, j = 0, len, ret = \"\", it, tmp;";


		if (node.main_expr.def[0].type === _Grips.parser.SET_LITERAL) {
			code += set_literal(node.main_expr.def[0]);
			code += "len = _set.length;";
			code += "ret2 = __iter__($,$$,_set[i],\"\"+i,i);";
			code += templateErrorGuard("ret","ret2");
			code += "}";
		}
		else if (node.main_expr.def[0].type === _Grips.parser.RANGE_LITERAL) {
			code += "len = " + (Math.abs(node.main_expr.def[0].def[0].val - node.main_expr.def[0].def[1].val) + 1) + ";";
			code += range_literal(node.main_expr.def[0]);
			code += "ret2 = __iter__($,$$,i,\"\"+i,j++);";
			code += templateErrorGuard("ret","ret2");
			code += "}";
		}
		else {
			code += "it = " + expr(node.main_expr) + ";";
			code += "if (it == null) {";
				code += "return \"\";";
			code += "}";
			code += "if (Array.isArray(it)) {";
				code += "len = it.length;";
				code += "for (i=0; i<len; i++) {";
					code += "ret2 = __iter__($,$$,it[i],\"\"+i,i);";
					code += templateErrorGuard("ret","ret2");
				code += "}";
			code += "} else if (typeof it === \"object\") {";
				code += "tmp = Object.keys(it);";
				code += "len = tmp.length;";
				code += "if (it instanceof RLH) {"; // are we iterating over a previously declared RangeLiteralHash?
					code += "tmp.sort(__sort_fn__);"; // work around Chrome-V8's buggy iteration order for "numeric" keys: http://code.google.com/p/v8/issues/detail?id=164
				code += "}";
				code += "for (i=0; i<len; i++) {";
					code += "ret2 = __iter__($,$$,it[tmp[i]],tmp[i],i);";
					code += templateErrorGuard("ret","ret2");
				code += "}";
			code += "} else {";
				code += "return ";

				code += "unerr;";
			code += "}";

			needs.sort = true;	// update collection dependencies list
			needs.RLH = true;	// update collection dependencies list
			needs.unerr = true;	// update collection dependencies list
		}


		code += "return ret;";
		code += "})();";
		code += templateErrorGuard("ret","ret2");
		return code;
	}

	function tagLet(node) {
		var i, code = "", def;

		code += "ret2 = (function"  + "($,$$){";
		code += "$$ = clone($$) || {};";
		code += "var i, ret = \"\", ret2, _;";

		for (i=0; i<node.def.length; i++) {
			def = node.def[i];

			code += assignment(def);

		}

		code += children(node);

		code += "return ret;";
		code += "})($,$$);";
		code += templateErrorGuard("ret","ret2");

		return code;
	}

	function tagIncludeTemplate(node) {
		var code = "", tmp;

		tmp = expr(node.context_expr);


			code += "ret2 = " + tmp + ";";



			code += "ret2 = G.render(" + expr(node.main_expr) + ",ret2,$$);";

		if (node.escapes) {
			code += "ret2 = esc(ret2," + JSON.stringify(node.escapes) + ");";
			needs.esc = true;	// update collection dependencies list
		}
		code += templateErrorGuard("ret","ret2");

		return code;
	}

	function tagInsertVar(node) {
		var code = "", tmp = expr(node.main_expr);


		if (node.escapes) {
			code += "ret += esc(" + tmp + "," + JSON.stringify(node.escapes) + ");";
			needs.esc = true;	// update collection dependencies list
		}
		else {
			code += "ret += " + tmp + ";";
		}


		return code;
	}

	function children(node) {
		var i, code = "", child;

		for (i=0; i<node.children.length; i++) {
			child = node.children[i];
			if (child.type === _Grips.parser.TEXT) {
				code += "ret += \"" + escapeNewlines(escapeEscapes(escapeDoubleQuotes(child.val))) + "\";";
			}
			else if (child.type === _Grips.parser.TAG_LOOP) {
				code += tagLoop(child);
			}
			else if (child.type === _Grips.parser.TAG_LET) {
				code += tagLet(child);
			}
			else if (child.type === _Grips.parser.TAG_INCL_TMPL) {
				code += tagIncludeTemplate(child);
			}
			else if (child.type === _Grips.parser.TAG_INSERT_VAR) {
				code += tagInsertVar(child);
			}
			else if (child.type === _Grips.parser.TAG_ESCAPE) {
				code += tagEscape(child);
			}
		}

		return code;
	}

	function templateErrorGuard(collector,test) {
		var code = "";


			code += collector + " += " + test + ";";


		return code;
	}

	function process(initialize) {
		var node, nodes = [], collection = "", code = "", tmp, tmp2;

		while ((node = _Grips.parser.parseNextNode())) {
			nodes.push(node);

			if (node.type === _Grips.parser.COLLECTION_MARKER) {
				if (node.start) {
					needs = {};
					tmp = startCollection(node);
					needs.cID_value = node.start;
					collection += tmp;
					code += tmp;
				}
				else if (node.close) {
					tmp2 = collectionDependencies(needs);
					tmp = closeCollection(node);
					collection += tmp;
					collection = collection.replace(/\/\*startCollection\*\//,tmp2);
					code += tmp;
					code = code.replace(/\/\*startCollection\*\//,tmp2);
					if (initialize) {
						_Grips.initializeCollection(node.close,collection);
					}
					collection = "";
				}
			}
			else if (node.type === _Grips.parser.TAG_EXTEND) {
				if (!(
						nodes.length > 1 &&
						nodes[nodes.length - 2].type === _Grips.parser.COLLECTION_MARKER
					)
				) {
					throw unknown_error;
				}
				tmp = tagExtend(node);
				collection += tmp;
				code += tmp;
			}
			else if (node.type === _Grips.parser.TAG_DEFINE) {
				tmp = tagDefine(node);
				collection += tmp;
				code += tmp;
			}
			else {
				throw unknown_error;
			}
		}

		return code;
	}

	var unknown_error = new Error("Unknown error"),
		needs
	;

	_Grips.generator = {
		process: process
	};

})(this,this.grips);

