/* grips-css (c) 2012-2015 Kyle Simpson | http://getify.mit-license.org/ */
exports.grips = global.grips || {};
(function __grips_css_node__(){
;

(function __grips_css_base__(global){
	var old_grips_css = global.grips.css;

	function createSandbox() {

		function noConflict() {
			var new_grips_css = global.grips.css;
			global.grips.css = old_grips.css;
			return new_grips_css;
		}

		function trim(str) {
			return str.trim ? str.trim() : str.replace(/^\s+/,"").replace(/\s+$/,"");
		}

		function encodeSelector(selector) {
			return _Grips_CSS.btoa(
				unescape(
					encodeURIComponent(
						trim(selector)
					)
				)
			);
		}

		function decodeSelector(b64) {
			return decodeURIComponent(
				escape(
					_Grips_CSS.atob(selector)
				)
			);
		}


		function compile(sources,initialize) {
			var ret = "", i, file_id;

			// default `initialize` to `true`
			initialize = (initialize !== false);

			if (Array.isArray(sources)) {
				for (i=0; i<sources.length; i++) {
					ret += compileFile(sources[i],null,initialize);
				}
			}
			else if (typeof sources === "object") {
				for (file_id in sources) { if (sources.hasOwnProperty(file_id)) {
					ret += compileFile(sources[file_id],file_id,initialize);
				}}
			}

			return ret;
		}

		function compileChunk(source,fileID) {
			if (!fileID) {
				throw new TemplateError("Missing file ID") ||unknown_error;
			}
			return compileFile(source,fileID,/*initialize=*/false);
		}

		function compileFile(source,fileID,initialize) {

			var _err;


			// default `initialize` to `true`
			initialize = (initialize !== false);

			try {
				if (_Grips_CSS.tokenizer.process(source,fileID)) {
					_Grips_CSS.parser.end(); // end the file stream
					return _Grips_CSS.generator.process(initialize);
				}
			}
			catch (err) {

				if (err instanceof _Grips.tokenizer.TokenizerError ||
					err instanceof _Grips.parser.ParserError
				) {
					throw err;
				}
				else {
					_err = _Grips.error(fileID,null,"Unexpected compilation error",err);
					_err.stack = err.stack; // try to preserve the original error call stack, if possible
					throw _err;
				}

				throw unknown_error;
			}
			return false;
		}

		function initialize(source) {
		}

		function initializeFile(fileID,source) {
			initialize(source);
		}


		function render(id,$,$$) {
			// default empty render?
			if (!id) return "";

			var ret;

			if (ret !== false) {
				return ret;
			}
			else {
				throw new _Grips.TemplateError("[" + id + "] Template not found") ||unknown_error;
			}
		}


		var _Grips = global.grips, _Grips_CSS, files = {},
			unknown_error = new Error("Unknown error")
		;

		_Grips_CSS = {


			compile: compile,
			compileChunk: compileChunk,
			compileFile: compileFile,

			initialize: initialize,
			initializeFile: initializeFile,


			render: render,

			noConflict: noConflict,
			sandbox: createSandbox,
			trim: trim,
			encodeSelector: encodeSelector,
			decodeSelector: decodeSelector
		};

		if (global && global.atob) {
			_Grips_CSS.atob = global.atob.bind(global);
			_Grips_CSS.btoa = global.btoa.bind(global);
		}
		else if (typeof require !== "undefined") {
			_Grips_CSS.atob = require("atob");
			_Grips_CSS.btoa = require("btoa");
		}

		return _Grips_CSS;
	}

	global.grips.css = createSandbox();

})(this);
;


(function __grips_tokenizer__(global,_Grips,_Grips_CSS){


	// translate raw char position into line/column mapping
	function lineCol(rawPos,fileID) {
		rawPos = Math.max(0,rawPos);
		var i, ret = { raw:rawPos, line:1, col:rawPos };

		for (i=0; i<start_of_line_map[fileID].length; i++) {
			if (start_of_line_map[fileID][i] > rawPos) {
				break;
			}
			ret.line = i + 1; // line numbers are 1-based
			ret.col = rawPos - start_of_line_map[fileID][i];
		}

		return ret;
	}


	/* Tokenizer */
	function generateNewChunkID() {
		var id;
		do {
			id = Math.floor(Math.random() * 1E9);
		} while (id in chunk_ids);
		return id;
	}

	function process(chunk,fileID) {

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
			var token, tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tmp = unmatched.match(/[^a-z0-9.@;#_-\s]/i);

				if (!tmp) {
					tmp = unmatched.split(/(\s+)/);
					for (i=0; i<tmp.length; i++) {
						if (tmp[i]) {
							token = new _Grips.tokenizer.Token({
								type: null,
								val: tmp[i],
								pos: lineCol(prev_match_idx,fileID)
							});

							if (/^\s+$/.test(tmp[i])) {
								token.type = TOKEN_WHITESPACE;
							}
							else {
								token.type = TOKEN_GENERAL;
							}

							tokens.push(token);
						}
					}
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0],
						pos: lineCol(prev_match_idx + tmp.index,fileID)
					})) ||unknown_error;
				}
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: TOKEN_UNKNOWN, // will be classified below if possible
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// @import statment?
				if (match[0] === "@import") {
					token.type = TOKEN_IMPORT;
				}
				// multi-line comment start?
				else if (match[0] === "/*") {
					token.type = TOKEN_MLCOMMENT_START;
				}
				// single-line comment start?
				else if (match[0] === "//") {
					token.type = TOKEN_SLCOMMENT_START;
				}
				// @* found (keyframe animations with vendor prefix expansion)
				else if (match[0] === "@*") {
					token.type = TOKEN_ATSTAR;
				}
				// brace open?
				else if (match[0] === "{") {
					token.type = TOKEN_BRACE_OPEN;
				}
				// parenthesis open (rule params list)?
				else if (match[0] === "(") {
					token.type = TOKEN_PAREN_OPEN;
				}
				// bracket open?
				else if (match[0] === "[") {
					token.type = TOKEN_BRACKET_OPEN;
				}
				// bracket close?
				else if (match[0] === "]") {
					token.type = TOKEN_BRACKET_CLOSE;
				}
				// , found?
				else if (match[0] === ",") {
					token.type = TOKEN_COMMA;
				}
				// : found?
				else if (match[0] === ":") {
					token.type = TOKEN_COLON;
				}
				// :: found?
				else if (match[0] === "::") {
					token.type = TOKEN_DOUBLECOLON;
				}
				// attribute match comparator found?
				else if (/[~|^$*]?\=/.test(match[0])) {
					token.type = TOKEN_ATTR_MATCH;
				}
				// CSS combinator found?
				else if (/^[>+~]$/.test(match[0])) {
					token.type = TOKEN_COMBINATOR;
				}
				// string literal start with quote?
				else if (/^["']$/.test(match[0])) {
					token.type = TOKEN_QUOTE;

					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL] = new RegExp(match[0],"g");
					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL].lastIndex = 0; // reset to prevent browser "regex caching" bug
				}
				else if (match[0] == "*") {
					token.type = TOKEN_STAR;
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||unknown_error;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handleCommentMatch() {
			var token, tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tokens.push(new _Grips.tokenizer.Token({
					type: TOKEN_GENERAL,
					val: unmatched,
					pos: lineCol(prev_match_idx,fileID)
				}));
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// is the match at the beginning or is it NOT escaped (can't escape newlines)?
				if (
					!leftContext ||
					_Grips_CSS.parser.state == _Grips_CSS.parser.STATE.SL_COMMENT ||
					not_escaped_pattern.test(leftContext)
				) {
					token.type = TOKEN_COMMENT_CLOSE;
				}
				else {
					token.type = TOKEN_GENERAL;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handleImportMatch() {
			var token, tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tmp = unmatched.match(/[^a-z0-9._-]/i);

				if (!tmp) {
					tokens.push(new _Grips.tokenizer.Token({
						type: TOKEN_GENERAL,
						val: unmatched,
						pos: lineCol(prev_match_idx,fileID)
					}));
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0],
						pos: lineCol(prev_match_idx + tmp.index,fileID)
					})) ||unknown_error;
				}
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				if (match[0] === ";") {
					token.type = TOKEN_SEMICOLON;
				}
				else if (/^\s+$/.test(match[0])) {
					token.type = TOKEN_WHITESPACE;
				}
				else if (/^["']$/.test(match[0])) {
					token.type = TOKEN_QUOTE;

					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL] = new RegExp(match[0],"g");
					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL].lastIndex = 0; // reset to prevent browser "regex caching" bug
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||unknown_error;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handleParamsMatch() {
			var token, tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tmp = unmatched.match(/[^a-z0-9._-]/i);

				if (!tmp) {
					tokens.push(new _Grips.tokenizer.Token({
						type: TOKEN_GENERAL,
						val: unmatched,
						pos: lineCol(prev_match_idx,fileID)
					}));
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0],
						pos: lineCol(prev_match_idx + tmp.index,fileID)
					})) ||unknown_error;
				}
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// , found?
				if (match[0] === ",") {
					token.type = TOKEN_COMMA;
				}
				// : found?
				else if (match[0] === ":") {
					token.type = TOKEN_COLON;
				}
				// ) closing of the params list?
				else if (match[0] === ")") {
					token.type = TOKEN_PAREN_CLOSE;
				}
				else if (/^\s+$/.test(match[0])) {
					token.type = TOKEN_WHITESPACE;
				}
				// string literal start with quote?
				else if (/^["']$/.test(match[0])) {
					token.type = TOKEN_QUOTE;

					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL] = new RegExp(match[0],"g");
					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL].lastIndex = 0; // reset to prevent browser "regex caching" bug
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||unknown_error;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handleStringLiteralMatch(){
			var token, tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tokens.push(new _Grips.tokenizer.Token({
					type: TOKEN_GENERAL,
					val: unmatched,
					pos: lineCol(prev_match_idx,fileID)
				}));
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// is the match at the beginning or is it NOT escaped?
				if (!leftContext || not_escaped_pattern.test(leftContext)) {
					token.type = TOKEN_QUOTE;

					// unset the pattern used to match the end of the literal
					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL] = null;
				}
				else {
					token.type = TOKEN_GENERAL;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handleInsideMatch() {
			var token, tokensSlice, leftContext, i;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tmp = unmatched.match(/[^a-z0-9%.#_-\s]/i);

				if (!tmp) {
					tmp = unmatched.split(/(\s+)/);
					for (i=0; i<tmp.length; i++) {
						if (tmp[i]) {
							token = new _Grips.tokenizer.Token({
								type: null,
								val: tmp[i],
								pos: lineCol(prev_match_idx,fileID)
							});

							if (/^\s+$/.test(tmp[i])) {
								token.type = TOKEN_WHITESPACE;
							}
							else {
								token.type = TOKEN_GENERAL;
							}

							tokens.push(token);
						}
					}
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0],
						pos: lineCol(prev_match_idx + tmp.index,fileID)
					})) ||unknown_error;
				}
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: TOKEN_UNKNOWN, // will be classified below if possible
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// multi-line comment start?
				if (match[0] === "/*") {
					token.type = TOKEN_MLCOMMENT_START;
				}
				// single-line comment start?
				else if (match[0] === "//") {
					token.type = TOKEN_SLCOMMENT_START;
				}
				// brace open?
				else if (match[0] === "{") {
					token.type = TOKEN_BRACE_OPEN;
				}
				// brace close?
				else if (match[0] === "}") {
					token.type = TOKEN_BRACE_CLOSE;
				}
				// parenthesis open (rule params list)?
				else if (match[0] === "(") {
					token.type = TOKEN_PAREN_OPEN;
				}
				// bracket open?
				else if (match[0] === "[") {
					token.type = TOKEN_BRACKET_OPEN;
				}
				// bracket close?
				else if (match[0] === "]") {
					token.type = TOKEN_BRACKET_CLOSE;
				}
				// , found?
				else if (match[0] === ",") {
					token.type = TOKEN_COMMA;
				}
				// ; found?
				else if (match[0] === ";") {
					token.type = TOKEN_SEMICOLON;
				}
				// : found?
				else if (match[0] === ":") {
					token.type = TOKEN_COLON;
				}
				// :: found?
				else if (match[0] === "::") {
					token.type = TOKEN_DOUBLECOLON;
				}
				// * found?
				else if (match[0] === "*") {
					token.type = TOKEN_STAR;
				}
				// = found?
				else if (match[0] === "=") {
					token.type = TOKEN_EQUALS;
				}
				// | found?
				else if (match[0] === "|") {
					token.type = TOKEN_PIPE;
				}
				// attribute match comparator found?
				else if (/[~|^$*]?\=/.test(match[0])) {
					token.type = TOKEN_ATTR_MATCH;
				}
				// CSS combinator found?
				else if (/^[>+~]$/.test(match[0])) {
					token.type = TOKEN_COMBINATOR;
				}
				// string literal start with quote?
				else if (/^["']$/.test(match[0])) {
					token.type = TOKEN_QUOTE;

					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL] = new RegExp(match[0],"g");
					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL].lastIndex = 0; // reset to prevent browser "regex caching" bug
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||unknown_error;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handlePrefixExpansionMatch() {
			var token, tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tokens.push(new _Grips.tokenizer.Token({
					type: TOKEN_GENERAL,
					val: unmatched,
					pos: lineCol(prev_match_idx,fileID)
				}));
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// multi-line comment start?
				if (match[0] === "/*") {
					token.type = TOKEN_MLCOMMENT_START;
				}
				// single-line comment start?
				else if (match[0] === "//") {
					token.type = TOKEN_SLCOMMENT_START;
				}
				// : found?
				else if (match[0] === ":") {
					token.type = TOKEN_COLON;
				}
				// ; found?
				else if (match[0] === ";") {
					token.type = TOKEN_SEMICOLON;
				}
				// brace close?
				else if (match[0] === "}") {
					token.type = TOKEN_BRACE_CLOSE;
				}
				// = found?
				else if (match[0] === "=") {
					token.type = TOKEN_EQUALS;
				}
				// whitespace found?
				else if (/^\s+$/.test(match[0])) {
					token.type = TOKEN_WHITESPACE;
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||unknown_error;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handleVariableMatch() {
			var token, tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tokens.push(new _Grips.tokenizer.Token({
					type: TOKEN_GENERAL,
					val: unmatched,
					pos: lineCol(prev_match_idx,fileID)
				}));
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// multi-line comment start?
				if (match[0] === "/*") {
					token.type = TOKEN_MLCOMMENT_START;
				}
				// single-line comment start?
				else if (match[0] === "//") {
					token.type = TOKEN_SLCOMMENT_START;
				}
				// ; found?
				else if (match[0] === ";") {
					token.type = TOKEN_SEMICOLON;
				}
				// } found?
				else if (match[0] === "}") {
					token.type = TOKEN_BRACE_CLOSE;
				}
				// | found?
				else if (match[0] === "|") {
					token.type = TOKEN_PIPE;
				}
				// whitespace found?
				else if (/^\s+$/.test(match[0])) {
					token.type = TOKEN_WHITESPACE;
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||unknown_error;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handleSetParamsMatch() {
			var token, tokensSlice, leftContext;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tmp = unmatched.match(/[^a-z0-9._-]/i);

				if (!tmp) {
					tokens.push(new _Grips.tokenizer.Token({
						type: TOKEN_GENERAL,
						val: unmatched,
						pos: lineCol(prev_match_idx,fileID)
					}));
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token2",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0],
						pos: lineCol(prev_match_idx + tmp.index,fileID)
					})) ||unknown_error;
				}
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// | found?
				if (match[0] === "|") {
					token.type = TOKEN_PIPE;
				}
				// : found?
				else if (match[0] === ":") {
					token.type = TOKEN_COLON;
				}
				// = found?
				else if (match[0] === "=") {
					token.type = TOKEN_EQUALS;
				}
				// ; closing of the params list?
				else if (match[0] === ";") {
					token.type = TOKEN_SEMICOLON;
				}
				else if (/^\s+$/.test(match[0])) {
					token.type = TOKEN_WHITESPACE;
				}
				// string literal start with quote?
				else if (/^["']$/.test(match[0])) {
					token.type = TOKEN_QUOTE;

					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL] = new RegExp(match[0],"g");
					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL].lastIndex = 0; // reset to prevent browser "regex caching" bug
				}
				else {
					return new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||unknown_error;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}

		function handleRuleValueMatch() {
			var token, tokensSlice, leftContext, i;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				tokens.push(new _Grips.tokenizer.Token({
					type: TOKEN_GENERAL,
					val: unmatched,
					pos: lineCol(prev_match_idx,fileID)
				}));
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: TOKEN_UNKNOWN, // will be classified below if possible
					val: match[0],
					pos: lineCol(next_match_idx - match[0].length,fileID)
				});

				// multi-line comment start?
				if (match[0] === "/*") {
					token.type = TOKEN_MLCOMMENT_START;
				}
				// single-line comment start?
				else if (match[0] === "//") {
					token.type = TOKEN_SLCOMMENT_START;
				}
				// string literal start with quote?
				else if (/^["']$/.test(match[0])) {
					token.type = TOKEN_QUOTE;

					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL] = new RegExp(match[0],"g");
					parser_state_patterns[_Grips_CSS.parser.STATE.STRING_LITERAL].lastIndex = 0; // reset to prevent browser "regex caching" bug
				}
				// ; found?
				else if (match[0] === ";") {
					token.type = TOKEN_SEMICOLON;
				}
				// * found?
				else if (match[0] === "*") {
					token.type = TOKEN_STAR;
				}
				// = found?
				else if (match[0] === "=") {
					token.type = TOKEN_EQUALS;
				}
				// } found?
				else if (match[0] === "}") {
					token.type = TOKEN_BRACE_CLOSE;
				}
				else {
					token.type = TOKEN_GENERAL;
				}

				tokens.push(token);
			}

			// run the parser step, only on the unprocessed tokens
			tokens = tokens.concat((tokensSlice = unescapeGeneralTokens(combineGeneralTokens(tokens.splice(token_idx-tokens.length)))));
			parser_res = _Grips_CSS.parser.nodify(tokensSlice,fileID);
			token_idx = tokens.length;
		}


		var regex, next_match_idx = 0, prev_match_idx = 0, token_idx = tokens.length,
			match, parser_state, unmatched, parser_res, token, res,
			tmp, new_line_regex = /\r?\n/g,
			match_handlers = [
				handleOutsideMatch,
				handleCommentMatch,
				handleCommentMatch,
				handleImportMatch,
				handleParamsMatch,
				handleStringLiteralMatch,
				handleInsideMatch,
				handlePrefixExpansionMatch,
				handleVariableMatch,
				handleSetParamsMatch,
				handleRuleValueMatch,
			]
		;

		// if we aren't given a `fileID` to associate the parsing with, substitute a random unique chunk ID
		if (!fileID) {
			fileID = generateNewChunkID();
			chunk_ids[fileID] = true;
			fileID = "chunk_" + fileID;
		}


		// initialize the line position tracker
		if (!(fileID in start_of_line_map)) {
			start_of_line_map[fileID] = [0];
		}


		while ((!parser_res || parser_res === true) && next_match_idx < chunk.length) {
			unmatched = "";
			parser_res = null;
			parser_state = _Grips_CSS.parser.state;
			if (parser_state === _Grips_CSS.parser.STATE.INVALID) break;

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


				// keep track of where lines are, for debugging purposes
				if (unmatched) {
					new_line_regex.lastIndex = 0; // reset global regex to avoid caching bugs
					while ((tmp = new_line_regex.exec(unmatched))) {
						start_of_line_map[fileID].push(prev_match_idx + tmp.index + tmp[0].length);
					}
				}

				new_line_regex.lastIndex = 0;
				while ((tmp = new_line_regex.exec(match))) {
					start_of_line_map[fileID].push(prev_match_idx + unmatched.length + tmp.index + tmp[0].length);
				}


				// invoke the match handler for current parser state
				res = match_handlers[parser_state]();
				if (res && res !== true) break;
				if (parser_res && parser_res !== true) break;
			}
			else {
				parser_res = new _Grips.parser.ParserError("Invalid parser state: " + parser_state) ||unknown_error;
				break;
			}
		}


		if (res instanceof _Grips.tokenizer.TokenizerError ||
			res instanceof _Grips.parser.ParserError
		) {
			throw res;
		}
		if (parser_res instanceof _Grips.tokenizer.TokenizerError ||
			parser_res instanceof _Grips.parser.ParserError
		) {
			throw parser_res;
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
		start_of_line_map = {},

		TOKEN_IMPORT = 0,
		TOKEN_MLCOMMENT_START = 1,
		TOKEN_SLCOMMENT_START = 2,
		TOKEN_COMMENT_CLOSE = 3,
		TOKEN_ATSTAR = 4,
		TOKEN_BRACE_OPEN = 5,
		TOKEN_BRACE_CLOSE = 6,
		TOKEN_PAREN_OPEN = 7,
		TOKEN_PAREN_CLOSE = 8,
		TOKEN_BRACKET_OPEN = 9,
		TOKEN_BRACKET_CLOSE = 10,
		TOKEN_QUOTE = 11,
		TOKEN_SEMICOLON = 12,
		TOKEN_WHITESPACE = 13,
		TOKEN_COLON = 14,
		TOKEN_DOUBLECOLON = 15,
		TOKEN_COMMA = 16,
		TOKEN_STAR = 17,
		TOKEN_EQUALS = 18,
		TOKEN_PIPE = 19,
		TOKEN_COMBINATOR = 20,
		TOKEN_ATTR_MATCH = 21,
		TOKEN_GENERAL = 22,
		TOKEN_UNKNOWN = 23,

		not_escaped_pattern = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/,
		parser_state_patterns = [
			/(?:@import(?=\s)|\/\*|\/\/|@\*|::|[~|^$*]\=)|[{("',>+~:\[\]=*]/g, /*outside*/
			/\*\//g, /*multi-line comment*/
			/\r?\n/g, /*single-line comment */
			/[;"']|\s+/g, /*@import*/
			/[:,\)"']|\s+|(?:\/\*|\/\/)/g, /*params*/
			null, /*string literal*/
			/::|[~|^$*]\=|[=;:*|{}"'(,>+~\[\]]|(?:\/\*|\/\/)/g, /*inside*/
			/[=;:}]|(?:\/\*|\/\/)/g, /*prefix expansion*/
			/\s+|(?:\/\*|\/\/)|[^a-zA-Z0-9_]/g, /*variable*/
			/[;:=|"'}]|\s+|(?:\/\*|\/\/)/g, /*set-param*/
			/[;"'=}*]|(?:\/\*|\/\/)/g /*rule-value*/
		],

		unknown_error = new Error("Unknown error")
	;

	_Grips_CSS.tokenizer = {
		IMPORT: TOKEN_IMPORT,
		MLCOMMENT_START: TOKEN_MLCOMMENT_START,
		SLCOMMENT_START: TOKEN_SLCOMMENT_START,
		COMMENT_CLOSE: TOKEN_COMMENT_CLOSE,
		ATSTAR: TOKEN_ATSTAR,
		BRACE_OPEN: TOKEN_BRACE_OPEN,
		BRACE_CLOSE: TOKEN_BRACE_CLOSE,
		PAREN_OPEN: TOKEN_PAREN_OPEN,
		PAREN_CLOSE: TOKEN_PAREN_CLOSE,
		BRACKET_OPEN: TOKEN_BRACKET_OPEN,
		BRACKET_CLOSE: TOKEN_BRACKET_CLOSE,
		QUOTE: TOKEN_QUOTE,
		SEMICOLON: TOKEN_SEMICOLON,
		WHITESPACE: TOKEN_WHITESPACE,
		COLON: TOKEN_COLON,
		DOUBLECOLON: TOKEN_DOUBLECOLON,
		COMMA: TOKEN_COMMA,
		STAR: TOKEN_STAR,
		EQUALS: TOKEN_EQUALS,
		PIPE: TOKEN_PIPE,
		COMBINATOR: TOKEN_COMBINATOR,
		ATTR_MATCH: TOKEN_ATTR_MATCH,
		GENERAL: TOKEN_GENERAL,
		UNKNOWN: TOKEN_UNKNOWN,

		process: process
	};

})(this,this.grips,this.grips.css);

;


(function __grips_css_parser__(global,_Grips,_Grips_CSS){

	/* Node */
	function Node(props) {
		_Grips.parser.Node.call(this,props);
	}
	Node.prototype = Object.create(_Grips.parser.Node);

	Node.prototype.showChildren = function() {
		var i, ret = "";
		if (this.children) {
			for (var i=0; i<this.children.length; i++) {
				if (this.children[i].type !== NODE_WHITESPACE) {
					ret += this.children[i].toString();
				}
			}
		}
		return ret;
	};


	Node.prototype.toString = function __Node_toString__(includeToken) {

		function showStringLiteral(node) {
			return (node.delimiter || "\"") + (node.val || "") + (node.delimiter || "\"");
		}

		function showParams(node) {
			var i, ret = "";
			if (node.children) {
				for (var i=0; i<node.children.length; i++) {
					ret += (ret !== "" ? ", " : "") + node.children[i].showChildren();
				}
			}
			return ret;
		}

		function showSetParams(node) {
			var i, ret = "";
			if (node.children) {
				for (var i=0; i<node.children.length; i++) {
					ret += (ret !== "" ? " | " : "") + node.children[i].showChildren();
				}
			}
			return ret;
		}

		var ret = "";

		if (this.type === NODE_TEXT ||
			this.type === NODE_OPERATOR ||
			this.type === NODE_UNKNOWN
		) {
			ret = this.token.val;
		}
		else if (this.type === NODE_WHITESPACE) {
			ret = " ";
		}
		else if (this.type === NODE_STRING_LITERAL) {
			ret = showStringLiteral(this);
		}
		else if (this.type === NODE_IMPORT_DIRECTIVE) {
			ret = "@import " + this.showChildren() + ";";
		}
		else if (this.type === NODE_RULES_BODY) {
			ret = "{ " + this.children[0].toString() + ".. }";
		}
		else if (this.type === NODE_RULE_VALUE) {
			ret = ":" + this.showChildren() + ";";
		}
		else if (this.type === NODE_PARAM_LIST) {
			ret = "(" + showParams(this) + ")";
		}
		else if (this.type === NODE_SET_PARAMS) {
			ret = "(" + showSetParams(this) + ")";
		}
		else if (this.type === NODE_PARAM) {
			ret = this.showChildren();
		}
		else if (this.type === NODE_VARIABLE) {
			ret = "=" + this.showChildren();
		}
		else if (this.type === NODE_PREFIX_EXPANDER) {
			ret = "*" + this.showChildren();
		}
		else if (this.type === NODE_SELECTOR) {
			ret = _Grips_CSS.trim(this.showChildren());
		}
		else if (this.type === NODE_RULE_PROPERTY ||
			this.type === NODE_RULE_VALUE ||
			this.type === NODE_INCLUDE_REF
		) {
			ret = this.showChildren();
		}
		else {
			ret = JSON.stringify(this);
		}

		if (includeToken && this.token) {
			ret += "; " + this.token;
		}

		return ret;
	};



	/* Parser */
	function nodify(tokens,fileID) {

		function revertToPreviousState() {
			current_parent.complete = true;
			instance_api.state = current_parent.previous_state;
			delete current_parent.previous_state;
			current_parent = current_parent.parent;
		}

		function handleOutsideState(token) {
			var node;

			node = new Node({
				parent: null,
				type: NODE_UNKNOWN,
				token: token,
				children: [],
				complete: false,
				previous_state: instance_api.state
			});

			if (token.type === _Grips_CSS.tokenizer.IMPORT) {
				node.type = NODE_IMPORT_DIRECTIVE;
				instance_api.state = NODE_STATE_IMPORT;
			}
			else if (token.type === _Grips_CSS.tokenizer.MLCOMMENT_START) {
				node.type = NODE_COMMENT;
				instance_api.state = NODE_STATE_ML_COMMENT;
			}
			else if (token.type === _Grips_CSS.tokenizer.SLCOMMENT_START) {
				node.type = NODE_COMMENT;
				instance_api.state = NODE_STATE_SL_COMMENT;
			}
			else if (token.type === _Grips_CSS.tokenizer.ATSTAR) {
				node.type = NODE_PREFIX_EXPANDER;
				instance_api.state = NODE_STATE_PREFIX_EXPANSION;
			}
			else if (token.type === _Grips_CSS.tokenizer.BRACE_OPEN) {
				node.type = NODE_RULES_BODY;
				instance_api.state = NODE_STATE_INSIDE;
			}
			else if (token.type === _Grips_CSS.tokenizer.PAREN_OPEN) {
				node.type = NODE_PARAM_LIST;
				instance_api.state = NODE_STATE_PARAMS;
			}
			else if (token.type === _Grips_CSS.tokenizer.BRACKET_OPEN) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.BRACKET_CLOSE) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.QUOTE) {
				instance_api.state = NODE_STATE_STRING_LITERAL;
				node.type = NODE_STRING_LITERAL;
				node.val = "";
				node.delimiter = token.val;
			}
			else if (token.type === _Grips_CSS.tokenizer.COMMA) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.COLON) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.DOUBLECOLON) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.ATTR_MATCH) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.COMBINATOR) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.STAR) {
				node.type = NODE_TEXT;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.EQUALS) {
				node.type = NODE_VARIABLE;
				instance_api.state = NODE_STATE_VARIABLE;
			}
			else if (token.type === _Grips_CSS.tokenizer.WHITESPACE) {
				node.type = NODE_WHITESPACE;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.GENERAL) {
				node.type = NODE_TEXT;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else {
				instance_api.state = NODE_STATE_INVALID;
				return new _Grips.parser.ParserError("Unexpected",token) ||unknown_error;
			}

			// if we get here, all's well so far, so save the node
			if (current_parent) {
				node.parent = current_parent;
				current_parent.children.push(node);
			}
			else {
				delete node.parent;
				nodes.push(node);
			}
			// if node is not complete yet, nest into it
			if (!node.complete) {
				current_parent = node;
			}
		}

		function handleCommentState(token) {
			if (token.type === _Grips_CSS.tokenizer.COMMENT_CLOSE) {
				revertToPreviousState();

				// discard the comment node once it's been fully processed
				/*if (current_parent) {
					current_parent.children.pop();
				}
				else {
					nodes.pop();
				}*/
			}
			else if (token.type === _Grips_CSS.tokenizer.GENERAL) {
				current_parent.children.push(new Node({
					parent: current_parent,
					type: NODE_TEXT,
					token: token,
					complete: true
				}));
			}
			else {
				instance_api.state = NODE_STATE_INVALID;
				return new _Grips.parser.ParserError("Unexpected",token) ||unknown_error;
			}
		}

		function handleImportState(token) {
			var node;

			node = new Node({
				parent: current_parent,
				type: NODE_UNKNOWN,
				token: token,
				children: [],
				complete: false,
				previous_state: instance_api.state
			});

			if (token.type === _Grips_CSS.tokenizer.SEMICOLON) {
				revertToPreviousState();
				return; // note: throwing away `node` as unnecessary
			}
			else if (token.type === _Grips_CSS.tokenizer.QUOTE) {
				node.type = NODE_STRING_LITERAL;
				node.val = "";
				node.delimiter = token.val;
				instance_api.state = NODE_STATE_STRING_LITERAL;
				current_parent.children.push(node);
				current_parent = node;
			}
			else if (token.type === _Grips_CSS.tokenizer.WHITESPACE) {
				// ignore whitespace in `@import` statement
				return; // note: throwing away `node` as unnecessary
			}
			else if (token.type === _Grips_CSS.tokenizer.GENERAL) {
				node.type = NODE_TEXT;
				delete node.children;
				current_parent.children.push(node);
			}
			else {
				instance_api.state = NODE_STATE_INVALID;
				return new _Grips.parser.ParserError("Unexpected",token) ||unknown_error;
			}
		}

		function handleParamsState(token) {
			var node;

			if (current_parent.type === NODE_PARAM_LIST) {
				if (token.type === _Grips_CSS.tokenizer.PAREN_CLOSE) {
					revertToPreviousState();
					return;
				}
				else {
					node = new Node({
						parent: current_parent,
						type: NODE_PARAM,
						token: token,
						children: [],
						complete: false
					});
					current_parent.children.push(node);
					current_parent = node;
				}
			}

			if (current_parent.type === NODE_PARAM) {
				if (token.type === _Grips_CSS.tokenizer.PAREN_CLOSE) {
					instance_api.state = current_parent.parent.previous_state;
					delete current_parent.parent.previous_state;
					current_parent.complete = true;
					current_parent.parent.complete = true;
					current_parent = current_parent.parent.parent;
				}
				else {
					node = new Node({
						parent: current_parent,
						type: NODE_UNKNOWN,
						token: token,
						complete: false
					});
					current_parent.children.push(node);

					if (token.type === _Grips_CSS.tokenizer.GENERAL) {
						node.type = NODE_TEXT;
						node.complete = true;
					}
					else if (token.type === _Grips_CSS.tokenizer.QUOTE) {
						node.previous_state = instance_api.state;
						node.type = NODE_STRING_LITERAL;
						node.val = "";
						node.delimiter = token.val;
						instance_api.state = NODE_STATE_STRING_LITERAL;
						current_parent = node;
					}
					else if (token.type === _Grips_CSS.tokenizer.COLON) {
						node.type = NODE_OPERATOR;
						node.complete = true;
					}
					else if (token.type === _Grips_CSS.tokenizer.WHITESPACE) {
						current_parent.children.pop(); // discard whitespace, unnecessary
					}
					else if (token.type === _Grips_CSS.tokenizer.COMMA) {
						current_parent.children.pop(); // discard the comma node, unnecessary
						current_parent.complete = true;
						current_parent = current_parent.parent;
					}
				}
			}
		}

		function handleStringLiteralState(token) {
			if (
				token.type === _Grips_CSS.tokenizer.QUOTE &&
				token.val === current_parent.delimiter
			) {
				revertToPreviousState();
			}
			else if (token.type === _Grips_CSS.tokenizer.GENERAL) {
				current_parent.val += token.val;
			}
			else {
				instance_api.state = NODE_STATE_INVALID;
				return new _Grips.parser.ParserError("Unexpected Text",token) ||unknown_error;
			}
		}

		function handleInsideState(token) {
			var node;

			node = new Node({
				parent: current_parent,
				type: NODE_UNKNOWN,
				token: token,
				children: [],
				complete: false,
				previous_state: instance_api.state
			});

			if (token.type === _Grips_CSS.tokenizer.MLCOMMENT_START) {
				node.type = NODE_COMMENT;
				instance_api.state = NODE_STATE_ML_COMMENT;
			}
			else if (token.type === _Grips_CSS.tokenizer.SLCOMMENT_START) {
				node.type = NODE_COMMENT;
				instance_api.state = NODE_STATE_SL_COMMENT;
			}
			else if (token.type === _Grips_CSS.tokenizer.BRACE_OPEN) {
				node.type = NODE_RULES_BODY;
				instance_api.state = NODE_STATE_INSIDE;
			}
			else if (token.type === _Grips_CSS.tokenizer.BRACE_CLOSE) {
				revertToPreviousState();
				return; // note: throwing away `node` as unnecessary
			}
			else if (token.type === _Grips_CSS.tokenizer.PAREN_OPEN) {
				node.type = NODE_PARAM_LIST;
				instance_api.state = NODE_STATE_PARAMS;
			}
			else if (token.type === _Grips_CSS.tokenizer.BRACKET_OPEN) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.BRACKET_CLOSE) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.QUOTE) {
				instance_api.state = NODE_STATE_STRING_LITERAL;
				node.type = NODE_STRING_LITERAL;
				node.val = "";
				node.delimiter = token.val;
			}
			else if (token.type === _Grips_CSS.tokenizer.COMMA) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.SEMICOLON) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.COLON) {
				instance_api.state = NODE_STATE_RULE_VALUE;
				node.type = NODE_RULE_VALUE;
			}
			else if (token.type === _Grips_CSS.tokenizer.DOUBLECOLON) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.STAR) {
				node.type = NODE_PREFIX_EXPANDER;
				current_parent.children.push(node);
				current_parent = new Node({
					parent: node,
					type: NODE_RULE_PROPERTY,
					token: token,
					children: [],
					complete: false,
					previous_state: NODE_STATE_PREFIX_EXPANSION
				});
				node.children.push(current_parent);
				instance_api.state = NODE_STATE_PREFIX_EXPANSION;

				return;
			}
			else if (token.type === _Grips_CSS.tokenizer.EQUALS) {
				node.type = NODE_VARIABLE;
				instance_api.state = NODE_STATE_VARIABLE;
			}
			else if (token.type === _Grips_CSS.tokenizer.PIPE) {
				node.type = NODE_SET_PARAMS;
				instance_api.state = NODE_STATE_SET_PARAMS;
			}
			else if (token.type === _Grips_CSS.tokenizer.ATTR_MATCH) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.COMBINATOR) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.WHITESPACE) {
				node.type = NODE_WHITESPACE;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.GENERAL) {
				node.type = NODE_TEXT;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else {
				instance_api.state = NODE_STATE_INVALID;
				return new _Grips.parser.ParserError("Unexpected",token) ||unknown_error;
			}

			// if we get here, all's well so far, so save the node
			if (current_parent) {
				node.parent = current_parent;
				current_parent.children.push(node);
			}
			else {
				delete node.parent;
				nodes.push(node);
			}
			// if node is not complete yet, nest into it
			if (!node.complete) {
				current_parent = node;
			}
		}

		function handlePrefixExpansionState(token) {
			var node;

			// first child to be added to rule-property node?
			if (current_parent.type === NODE_RULE_PROPERTY &&
				current_parent.children.length === 0
			) {
				// overwrite the property's * token annotation
				current_parent.token = token;
			}

			node = new Node({
				parent: current_parent,
				type: NODE_UNKNOWN,
				token: token,
				children: [],
				complete: false,
				previous_state: instance_api.state
			});

			// implicitly ending the prefix expansion state?
			if (token.type === _Grips_CSS.tokenizer.SEMICOLON) {
				revertToPreviousState();

				// drop/ignore semicolon node, not needed
				return null;
			}
			// closing brace?
			else if (token.type === _Grips_CSS.tokenizer.BRACE_CLOSE) {
				revertToPreviousState();
				return state_handlers[instance_api.state](token);
			}
			// multi-line comment?
			else if (token.type === _Grips_CSS.tokenizer.MLCOMMENT_START) {
				node.type = NODE_COMMENT;
				instance_api.state = NODE_STATE_ML_COMMENT;
				current_parent.children.push(node);
				current_parent = node;
			}
			// single-line comment?
			else if (token.type === _Grips_CSS.tokenizer.SLCOMMENT_START) {
				node.type = NODE_COMMENT;
				instance_api.state = NODE_STATE_SL_COMMENT;
				current_parent.children.push(node);
				current_parent = node;
			}
			// colon operator?
			else if (token.type === _Grips_CSS.tokenizer.COLON) {
				node.type = NODE_RULE_VALUE;
				node.parent = current_parent.parent;
				node.parent.children.push(node);
				current_parent.complete = true;
				current_parent = node;
				instance_api.state = NODE_STATE_RULE_VALUE;
			}
			// recognized general token?
			else if (token.type === _Grips_CSS.tokenizer.GENERAL) {
				node.type = NODE_TEXT;
				node.complete = true;
				delete node.children;
				delete node.previous_state;
				current_parent.children.push(node);
			}
			// otherwise, error!
			else {
				instance_api.state = NODE_STATE_INVALID;
				return new _Grips.parser.ParserError("Unexpected",token) ||unknown_error;
			}
		}

		function handleVariableState(token) {
			// recognized general token?
			if (token.type === _Grips_CSS.tokenizer.GENERAL) {
				current_parent.children.push(new Node({
					parent: current_parent,
					type: NODE_TEXT,
					token: token,
					complete: true
				}));
			}
			// otherwise, implicitly ending the variable state
			else {
				revertToPreviousState();
				return state_handlers[instance_api.state](token);
			}
		}

		function handleSetParamsState(token) {
			var node;

			if (current_parent.type === NODE_SET_PARAMS) {
				if (token.type === _Grips_CSS.tokenizer.SEMICOLON) {
					revertToPreviousState();
					return state_handlers[instance_api.state](token);
				}
				else {
					node = new Node({
						parent: current_parent,
						type: NODE_PARAM,
						token: token,
						children: [],
						complete: false
					});
					current_parent.children.push(node);
					current_parent = node;
				}
			}

			if (current_parent.type === NODE_PARAM) {
				if (token.type === _Grips_CSS.tokenizer.SEMICOLON) {
					instance_api.state = current_parent.parent.previous_state;
					delete current_parent.parent.previous_state;
					current_parent.complete = true;
					current_parent.parent.complete = true;
					current_parent = current_parent.parent.parent;
					return state_handlers[instance_api.state](token);
				}
				else {
					node = new Node({
						parent: current_parent,
						type: NODE_UNKNOWN,
						token: token,
						complete: false
					});
					current_parent.children.push(node);

					if (token.type === _Grips_CSS.tokenizer.MLCOMMENT_START) {
						node.type = NODE_COMMENT;
						instance_api.state = NODE_STATE_ML_COMMENT;
					}
					else if (token.type === _Grips_CSS.tokenizer.SLCOMMENT_START) {
						node.type = NODE_COMMENT;
						instance_api.state = NODE_STATE_SL_COMMENT;
					}
					else if (token.type === _Grips_CSS.tokenizer.QUOTE) {
						node.previous_state = instance_api.state;
						node.type = NODE_STRING_LITERAL;
						node.val = "";
						node.delimiter = token.val;
						instance_api.state = NODE_STATE_STRING_LITERAL;
						current_parent = node;
					}
					else if (token.type === _Grips_CSS.tokenizer.COLON) {
						node.type = NODE_OPERATOR;
						node.complete = true;
					}
					else if (token.type === _Grips_CSS.tokenizer.WHITESPACE) {
						current_parent.children.pop(); // discard whitespace, unnecessary
					}
					else if (token.type === _Grips_CSS.tokenizer.PIPE) {
						current_parent.children.pop(); // discard the pipe node, unnecessary
						current_parent.complete = true;
						current_parent = current_parent.parent;
					}
					else if (token.type === _Grips_CSS.tokenizer.EQUALS) {
						node.previous_state = instance_api.state;
						node.type = NODE_VARIABLE;
						node.children = [];
						instance_api.state = NODE_STATE_VARIABLE;
						current_parent = node;
					}
					else if (token.type === _Grips_CSS.tokenizer.GENERAL) {
						node.type = NODE_TEXT;
						node.complete = true;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new _Grips.parser.ParserError("Unexpected",token) ||unknown_error;
					}
				}
			}
		}

		function handleRuleValueState(token) {
			var node;

			// first child to be added to rule-value node?
			if (current_parent.children.length === 0) {
				// overwrite the value's : token annotation
				current_parent.token = token;
			}

			node = new Node({
				parent: current_parent,
				type: NODE_UNKNOWN,
				token: token,
				children: [],
				complete: false,
				previous_state: instance_api.state
			});

			if (token.type === _Grips_CSS.tokenizer.MLCOMMENT_START) {
				node.type = NODE_COMMENT;
				instance_api.state = NODE_STATE_ML_COMMENT;
				current_parent.children.push(node);
				current_parent = node;
			}
			else if (token.type === _Grips_CSS.tokenizer.SLCOMMENT_START) {
				node.type = NODE_COMMENT;
				instance_api.state = NODE_STATE_SL_COMMENT;
				current_parent.children.push(node);
				current_parent = node;
			}
			else if (token.type === _Grips_CSS.tokenizer.QUOTE) {
				instance_api.state = NODE_STATE_STRING_LITERAL;
				node.type = NODE_STRING_LITERAL;
				node.val = "";
				node.delimiter = token.val;
				current_parent.children.push(node);
				current_parent = node;
			}
			else if (token.type === _Grips_CSS.tokenizer.SEMICOLON) {
				revertToPreviousState();

				if (instance_api.state === NODE_STATE_PREFIX_EXPANSION) {
					return state_handlers[instance_api.state](token);
				}
				else {
					// drop/ignore semicolon node, not needed
					return null;
				}
			}
			else if (token.type === _Grips_CSS.tokenizer.BRACE_CLOSE) {
				revertToPreviousState();
				return state_handlers[instance_api.state](token);
			}
			else if (token.type === _Grips_CSS.tokenizer.STAR) {
				// in a prefix-expander and * is first (non-whitespace)
				// token in rule-value?
				if (current_parent.parent.type === NODE_PREFIX_EXPANDER &&
					(
						// no contents yet?
						current_parent.children.length === 0 ||
						// only whitespace so far?
						/(?:^|,)\s*$/.test(current_parent.showChildren())
					)
				) {
					node.type = NODE_PREFIX_INCLUDE;
				}
				else {
					node.type = NODE_OPERATOR;
				}

				node.complete = true;
				delete node.previous_state;
				delete node.children;
				current_parent.children.push(node);
			}
			else if (token.type === _Grips_CSS.tokenizer.EQUALS) {
				node.type = NODE_VARIABLE;
				instance_api.state = NODE_STATE_VARIABLE;
				current_parent.children.push(node);
				current_parent = node;
			}
			else if (token.type === _Grips_CSS.tokenizer.WHITESPACE ||
				token.type === _Grips_CSS.tokenizer.GENERAL
			) {
				node.type = NODE_TEXT;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
				current_parent.children.push(node);
			}
			else {
				instance_api.state = NODE_STATE_INVALID;
				return new _Grips.parser.ParserError("Unexpected",token) ||unknown_error;
			}
		}


		var idx, node, res,
			state_handlers = [
				handleOutsideState,
				handleCommentState,
				handleCommentState,
				handleImportState,
				handleParamsState,
				handleStringLiteralState,
				handleInsideState,
				handlePrefixExpansionState,
				handleVariableState,
				handleSetParamsState,
				handleRuleValueState
			]
		;

		// need to insert a start fileID marker into the node stream?
		if (fileID !== current_file_id) {
			// need to close a current fileID marker?
			if (current_file_id) {
				nodes.push(new _Grips_CSS.parser.Node({
					type: NODE_FILE_MARKER,
					close: current_file_id,
					complete: true
				}));
			}

			current_file_id = fileID;

			nodes.push(new _Grips_CSS.parser.Node({
				type: NODE_FILE_MARKER,
				start: fileID,
				complete: true
			}));
		}

		// loop over the tokens
		for (idx=0; idx<tokens.length; idx++) {
			if (instance_api.state === NODE_STATE_INVALID) {
				return new _Grips.parser.ParserError("Invalid parser state: " + instance_api.state) ||unknown_error;
			}

			// invoke the parser state handler
			res = state_handlers[instance_api.state](tokens[idx]);
			if (res) return res;
		}

		return true;
	}

	// ends the current collection stream
	function end() {
		if (current_file_id) {
			nodes.push(new _Grips_CSS.parser.Node({
				type: NODE_FILE_MARKER,
				close: current_file_id,
				complete: true
			}));
		}
		current_file_id = null;
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

	function parseChildren(node) {
		var ret = [], ret2, i;

		// need to parse a node's children?
		if (node.children && node.children.length > 0) {
			node.children = combineNodes(node.children);

			for (i=0; i<node.children.length; i++) {
				if (!("parent" in node.children[i])) {
					node.children[i].parent = node;
				}
				ret2 = parse(node.children[i]);
				if (ret2) ret.push(ret2);
			}
			node.children = combineNodes(ret);
		}
	}

	function parse(node) {
		var tmp, i, parent_node = node.parent;

		delete node.parent;
		delete node.previous_state;

		// implicitly end a collector node?
		if (parse_collector_node &&
			parse_collector_node.type === NODE_UNKNOWN
		) {
			// file-markers/@import ending current collector?
			if (node.type === NODE_FILE_MARKER ||
				node.type === NODE_IMPORT_DIRECTIVE ||
				(
					node.type === NODE_OPERATOR &&
					node.token.type === _Grips_CSS.tokenizer.UNKNOWN
				)
			) {
				// collector node stays "unknown"
				parse_collector_node.complete = true;
				parse_collector_node.children = combineNodes(parse_collector_node.children);
				parse_collector_node = null;
			}
			// rules-body ending current collector?
			else if (node.type === NODE_RULES_BODY) {
				// identify previous "unknown" collector as selector
				parse_collector_node.type = NODE_SELECTOR;
				parse_collector_node.complete = true;

				// re-parse collector node
				parse_collector_node.parent = parent_node;
				parse(parse_collector_node);

				// clean up collector node's children
				parse_collector_node.children = combineNodes(parse_collector_node.children);
				parse_collector_node = null;
			}
			// rule-value ending current collector?
			else if (node.type === NODE_RULE_VALUE) {
				// identify previous "unknown" collector as rule-property
				parse_collector_node.type = NODE_RULE_PROPERTY;
				parse_collector_node.complete = true;

				// re-parse collector node
				parse_collector_node.parent = parent_node;
				parse(parse_collector_node);

				// clean up collector node's children
				parse_collector_node.children = combineNodes(parse_collector_node.children);
				parse_collector_node = null;
			}
			// semicolon ending current collector?
			else if (node.type === NODE_OPERATOR &&
				node.token.type === _Grips_CSS.tokenizer.SEMICOLON
			) {
				// identify previous "unknown" collector as include-ref
				parse_collector_node.type = NODE_INCLUDE_REF;
				parse_collector_node.complete = true;

				// re-parse node as newly identified type
				parse_collector_node.parent = parent_node;
				parse(parse_collector_node);

				// clean up collector node's children
				parse_collector_node.children = combineNodes(parse_collector_node.children);
				parse_collector_node = null;

				// drop/ignore semicolon node, not needed
				return null;
			}
			// missing semicolon assumed/implied by closing brace?
			else if (node.type === NODE_OPERATOR &&
				node.token.type === _Grips_CSS.tokenizer.BRACE_CLOSE
			) {
				// identify previous "unknown" collector as include-ref
				parse_collector_node.type = NODE_INCLUDE_REF;
				parse_collector_node.complete = true;

				// re-parse node as newly identified type
				parse_collector_node.parent = parent_node;
				parse(parse_collector_node);

				// clean up collector node's children
				parse_collector_node.children = combineNodes(parse_collector_node.children);
				parse_collector_node = null;
			}
		}

		// in a position where a collector node can collect?
		if (!parent_node ||
			parent_node.type === NODE_RULES_BODY
		) {
			if (node.type === NODE_TEXT ||
				node.type === NODE_OPERATOR ||
				node.type === NODE_VARIABLE ||
				node.type === NODE_STRING_LITERAL
			) {
				// implicitly start a collector node?
				if (!parse_collector_node) {
					parse_collector_node = new Node({
						type: NODE_UNKNOWN,
						token: node.token,
						children: [ node ],
						complete: false
					});

					if (parent_node) {
						parse_collector_node.parent = parent_node;
					}
					node.parent = parse_collector_node;

					return parse_collector_node;
				}
				// otherwise, add to existing collector node
				else {
					parse_collector_node.children.push(node);
					return null; // already captured node into `children`
				}
			}
			else if (node.type === NODE_PARAM_LIST ||
				node.type === NODE_SET_PARAMS ||
				node.type === NODE_WHITESPACE ||
				node.type === NODE_COMMENT
			) {
				// collector node in effect?
				if (parse_collector_node) {
					parse_collector_node.children.push(node);
					return null; // already captured node into `children`
				}
				// otherwise, return node untouched
				else {
					return node;
				}
			}
			else if (node.type === NODE_IMPORT_DIRECTIVE ||
				node.type === NODE_SELECTOR ||
				node.type === NODE_PREFIX_EXPANDER ||
				node.type === NODE_RULES_BODY ||
				node.type === NODE_RULE_PROPERTY ||
				node.type === NODE_RULE_VALUE
			) {
				parseChildren(node);
				return node;
			}
			else if (node.type === NODE_INCLUDE_REF) {
				// validate acceptable children of include-ref node
				for (i=0; i<node.children.length; i++) {
					if (!(
						node.children[i].type === NODE_TEXT ||
						node.children[i].type === NODE_WHITESPACE ||
						node.children[i].type === NODE_OPERATOR ||
						node.children[i].type === NODE_STRING_LITERAL ||
						node.children[i].type === NODE_COMMENT ||
						node.children[i].type === NODE_SET_PARAMS
					)) {
						throw new _Grips.parser.ParserError("Unexpected",node.children[i]) ||unknown_error;
					}
				}

				parseChildren(node);
				return node;
			}
			else if (node.type === NODE_FILE_MARKER) {
				if (node.start) {
					current_file_id = node.start;
				}
				else if (node.close) {
					current_file_id = null;
				}
				return node;
			}
			else {
				throw new _Grips.parser.ParserError("Unexpected",node) ||unknown_error;
			}
		}
		else if (node.type === NODE_PARAM_LIST ||
			node.type === NODE_SET_PARAMS ||
			node.type === NODE_PARAM
		) {
			parseChildren(node);
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
		parse_collector_node,
		current_file_id = "",
		node_idx = 0,

		NODE_STATE_OUTSIDE = 0,
		NODE_STATE_ML_COMMENT = 1,
		NODE_STATE_SL_COMMENT = 2,
		NODE_STATE_IMPORT = 3,
		NODE_STATE_PARAMS = 4,
		NODE_STATE_STRING_LITERAL = 5,
		NODE_STATE_INSIDE = 6,
		NODE_STATE_PREFIX_EXPANSION = 7,
		NODE_STATE_VARIABLE = 8,
		NODE_STATE_SET_PARAMS = 9,
		NODE_STATE_RULE_VALUE = 10,
		NODE_STATE_INVALID = 11,

		NODE_TEXT = 0,
		NODE_FILE_MARKER = 1,
		NODE_IMPORT_DIRECTIVE = 2,
		NODE_COMMENT = 3,
		NODE_PREFIX_EXPANDER = 4,
		NODE_RULES_BODY = 5,
		NODE_PARAM_LIST = 6,
		NODE_STRING_LITERAL = 7,
		NODE_OPERATOR = 8,
		NODE_PARAM = 9,
		NODE_VARIABLE = 10,
		NODE_SET_PARAMS = 11,
		NODE_WHITESPACE = 12,
		NODE_SELECTOR = 13,
		NODE_RULE_PROPERTY = 14,
		NODE_RULE_VALUE = 15,
		NODE_INCLUDE_REF = 16,
		NODE_PREFIX_INCLUDE = 17,
		NODE_UNKNOWN = 18,

		instance_api,

		unknown_error = new Error("Unknown error")
	;

	instance_api = {
		STATE: {
			OUTSIDE: NODE_STATE_OUTSIDE,
			ML_COMMENT: NODE_STATE_ML_COMMENT,
			SL_COMMENT: NODE_STATE_SL_COMMENT,
			IMPORT: NODE_STATE_IMPORT,
			PARAMS: NODE_STATE_PARAMS,
			STRING_LITERAL: NODE_STATE_STRING_LITERAL,
			INSIDE: NODE_STATE_INSIDE,
			PREFIX_EXPANSION: NODE_STATE_PREFIX_EXPANSION,
			VARIABLE: NODE_STATE_VARIABLE,
			SET_PARAMS: NODE_STATE_SET_PARAMS,
			INVALID: NODE_STATE_INVALID
		},

		TEXT: NODE_TEXT,
		FILE_MARKER: NODE_FILE_MARKER,
		IMPORT_DIRECTIVE: NODE_IMPORT_DIRECTIVE,
		COMMENT: NODE_COMMENT,
		PREFIX_EXPANDER: NODE_PREFIX_EXPANDER,
		RULES_BODY: NODE_RULES_BODY,
		PARAM_LIST: NODE_PARAM_LIST,
		STRING_LITERAL: NODE_STRING_LITERAL,
		OPERATOR: NODE_OPERATOR,
		PARAM: NODE_PARAM,
		VARIABLE: NODE_VARIABLE,
		SET_PARAMS: NODE_SET_PARAMS,
		WHITESPACE: NODE_WHITESPACE,
		SELECTOR: NODE_SELECTOR,
		RULE_PROPERTY: NODE_RULE_PROPERTY,
		RULE_VALUE: NODE_RULE_VALUE,
		INCLUDE_REF: NODE_INCLUDE_REF,
		PREFIX_INCLUDE: NODE_PREFIX_INCLUDE,
		UNKNOWN: NODE_UNKNOWN,

		state: NODE_STATE_OUTSIDE,

		nodify: nodify,
		end: end,
		parseNextNode: parseNextNode,

		dumpNodes: function() {
			return JSON.stringify(nodes,null,"\t");
		},

		Node: Node
	};

	_Grips_CSS.parser = instance_api;

})(this,this.grips,this.grips.css);

;


(function __grips_css_generator__(global,_Grips,_Grips_CSS){

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


	function identifierify(str) {
		str = str.replace(/[^a-z0-9_$]/ig,"_");
		return str;
	}


	function parentSelector() {
		return parent_selector.length > 0 ?
			parent_selector[parent_selector.length - 1] + " " :
			""
		;
	}

	function importDirective(node) {
		var id = "";
		if (node.children[0].type === _Grips_CSS.parser.TEXT) {
			id = node.children[0].token.val;
		}
		else if (node.children[0].type === _Grips_CSS.parser.STRING_LITERAL) {
			id = node.children[0].val;
		}
		render_all_collection += "{$= @\"" + id + "#all\" $}\n";
		return "{$+ \"" + id + "\" $}\n";
	}

	function comment(node) {
		var ret = "/*";

		if (node.children[0].token.type === _Grips_CSS.tokenizer.SLCOMMENT_START) {
			ret += "//";
		}
		ret += node.children[0].token.val + "*/";
		return ret;
	}

	function stringLiteral(node) {
		return node.delimiter + node.val + node.delimiter;
	}

	function simpleValue(node) {
		if (node.type === _Grips_CSS.parser.TEXT ||
			node.type === _Grips_CSS.parser.WHITESPACE ||
			node.type === _Grips_CSS.parser.OPERATOR
		) {
			return node.token.val;
		}
		else if (node.type === _Grips_CSS.parser.STRING_LITERAL) {
			return stringLiteral(node);
		}
		else if (node.type === _Grips_CSS.parser.COMMENT) {
			return comment(node);
		}
	}

	function param(node) {
		var varname = "", varvalue = "", k;

		for (k=0; k<node.children.length; k++) {
			if (node.children[k].type === _Grips_CSS.parser.OPERATOR &&
				node.children[k].token.type === _Grips_CSS.tokenizer.COLON
			) {
				break;
			}
			else if (!(
				node.children[k].type === _Grips_CSS.parser.WHITESPACE ||
				node.children[k].type === _Grips_CSS.parser.COMMENT
			)) {
				varname += node.children[k].token.val;
			}
		}
		for (k=k+1; k<node.children.length; k++) {
			if (!(
				node.children[k].type === _Grips_CSS.parser.WHITESPACE ||
				node.children[k].type === _Grips_CSS.parser.COMMENT
			)) {
				if (node.children[k].type === _Grips_CSS.parser.STRING_LITERAL) {
					varvalue += "\"" + node.children[k].val + "\"";
				}
				else if (node.children[k].type === _Grips_CSS.parser.VARIABLE) {
					varvalue += variableReference(node.children[k]);
				}
				else {
					varvalue += "\"" + node.children[k].token.val + "\"";
				}
			}
		}

		return [varname,varvalue];
	}

	function selector(node) {

		function paramStr(node) {
			var param_parts = param(node);
			return param_parts[0] + " = " + param_parts[0] + " ? " + param_parts[0] + " : " + param_parts[1];
		}

		var sel_text = "", param_list = "", tmp, id, i, j;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				sel_text += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.PARAM_LIST) {
				for (j=0; j<node.children[i].children.length; j++) {
					if (node.children[i].children[j].type === _Grips_CSS.parser.PARAM) {
						param_list += " | " + paramStr(node.children[i].children[j]);
					}
				}
			}
		}

		sel_text = parentSelector() + _Grips_CSS.trim(sel_text);
		parent_selector.push(sel_text);
		id = _Grips_CSS.encodeSelector(sel_text);

		render_all_collection += "{$= @\"#" + id + "\" $}\n";

		return "{$: \"#" + id + "\" }" +
			sel_text + " {{$= @\"#" + id + "_\" $}}{$}\n" +
			"{$: \"#" + id + "_\"" + param_list + " }";
	}

	function variableReference(node) {
		var ref_str = "", tmp, i;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				ref_str += tmp;
			}
		}

		return ref_str;
	}

	function ruleProperty(node) {
		var prop_str = "", tmp, i;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				prop_str += tmp;
			}
		}

		return prop_str;
	}

	function ruleValue(node) {
		var val_str = "", tmp, i;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				val_str += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.VARIABLE) {
				val_str += "{$= " + variableReference(node.children[i]) + " $}";
			}
			else if (node.children[i].type === _Grips_CSS.parser.PREFIX_INCLUDE) {
				val_str += "{$= __vprfx__ $}";
			}
		}

		return val_str;
	}

	function prefixExpander(node) {
		var ex_str = "";

		ex_str += "{$* $.__prefixes__ | __vprfx__ = vendor_prefix ? vendor_prefix : _.value | $.__newline = _.last ? \"\" : \"\\n\" }";
		ex_str += "{$= __vprfx__ $}" + ruleProperty(node.children[0]) + ":" + ruleValue(node.children[1]) + ";{$= $.__newline $}";
		ex_str += "{$}";

		return ex_str;
	}

	function rulesBody(node) {
		var rules_body = "", post_rules_body = "", tmp, i;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.SELECTOR) {
				tmp = selector(node.children[i]);
				post_rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.RULES_BODY) {
				tmp = rulesBody(node.children[i]);
				post_rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.INCLUDE_REF) {
				tmp = includeReference(node.children[i]);
				rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.RULE_PROPERTY) {
				tmp = ruleProperty(node.children[i]);
				rules_body += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.RULE_VALUE) {
				tmp = ruleValue(node.children[i]);
				rules_body += ":" + tmp + ";";
			}
			else if (node.children[i].type === _Grips_CSS.parser.PREFIX_EXPANDER) {
				tmp = prefixExpander(node.children[i]);
				rules_body += tmp;
			}
			else {
				throw new _Grips.parser.ParserError("Unexpected",node.children[i]) ||unknown_error;
			}
		}

		parent_selector.pop();

		return rules_body + "{$}\n" + (post_rules_body !== "" ? post_rules_body + "\n" : "");
	}

	function includeReference(node) {

		function paramStr(node) {
			var param_parts = param(node);
			return param_parts[0] + " = " + param_parts[1];
		}

		var sel_text = "", param_list = "", tmp, id, i, j;

		for (i=0; i<node.children.length; i++) {
			if (tmp = simpleValue(node.children[i])) {
				sel_text += tmp;
			}
			else if (node.children[i].type === _Grips_CSS.parser.SET_PARAMS) {
				for (j=0; j<node.children[i].children.length; j++) {
					if (node.children[i].children[j].type === _Grips_CSS.parser.PARAM) {
						param_list += (param_list !== "" ? " | " : "") + paramStr(node.children[i].children[j]);
					}
				}
			}
		}

		sel_text = _Grips_CSS.trim(sel_text);
		id = _Grips_CSS.encodeSelector(sel_text);

		return "{$# " + param_list + " }{$= @\"#" + id + "_\" $}{$}";
	}

	function process(initialize) {
		var node, next_idx = 0, i, nodes = [], file = "", code = "", tmp, tmp2;

		while ((node = _Grips_CSS.parser.parseNextNode())) {
			nodes.push(node);

			for (i=next_idx; i<nodes.length && nodes[i].complete; i++, next_idx++) {
				node = nodes[i];

				if (node.type === _Grips_CSS.parser.FILE_MARKER) {
					if (node.start) {
						render_all_collection = "\n{$: \"#all\" }";
					}
					else if (node.close) {
						tmp = render_all_collection + "{$}\n";
						file += tmp;
						code += tmp;
						render_all_collection = "";
					}
				}
				else if (tmp = simpleValue(node)) {
					render_all_collection += tmp;
				}
				else if (node.type === _Grips_CSS.parser.IMPORT_DIRECTIVE) {
					tmp = importDirective(node);
					file += tmp;
					code += tmp;
				}
				else if (node.type === _Grips_CSS.parser.SELECTOR) {
					tmp = selector(node);
					file += tmp;
					code += tmp;
				}
				else if (node.type === _Grips_CSS.parser.RULES_BODY) {
					tmp = rulesBody(node);
					file += tmp;
					code += tmp;
				}
				else {
					throw new _Grips.parser.ParserError("Unexpected text outside of rules body",node) ||unknown_error;
				}
			}
		}

		return code;
	}

	var unknown_error = new Error("Unknown error"),
		render_all_collection = "",	parent_selector = []
	;

	_Grips_CSS.generator = {
		process: process
	};

})(this,this.grips,this.grips.css);


}).call(exports);