/* grips-css (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/ */

/* START_COMPILER */
(function __grips_tokenizer__(global,_Grips,_Grips_CSS){

/* START_DEBUG */
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
/* STOP_DEBUG */

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
								val: tmp[i]/* START_DEBUG */,
								pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0]/* START_DEBUG */,
						pos: lineCol(prev_match_idx + tmp.index,fileID)/* STOP_DEBUG */
					})) ||/* STOP_DEBUG */unknown_error;
				}
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: TOKEN_UNKNOWN, // will be classified below if possible
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
				else {
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
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
					val: unmatched/* START_DEBUG */,
					pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
				}));
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
						val: unmatched/* START_DEBUG */,
						pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
					}));
				}
				else {
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0]/* START_DEBUG */,
						pos: lineCol(prev_match_idx + tmp.index,fileID)/* STOP_DEBUG */
					})) ||/* STOP_DEBUG */unknown_error;
				}
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
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
						val: unmatched/* START_DEBUG */,
						pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
					}));
				}
				else {
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0]/* START_DEBUG */,
						pos: lineCol(prev_match_idx + tmp.index,fileID)/* STOP_DEBUG */
					})) ||/* STOP_DEBUG */unknown_error;
				}
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
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
					val: unmatched/* START_DEBUG */,
					pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
				}));
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
								val: tmp[i]/* START_DEBUG */,
								pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0]/* START_DEBUG */,
						pos: lineCol(prev_match_idx + tmp.index,fileID)/* STOP_DEBUG */
					})) ||/* STOP_DEBUG */unknown_error;
				}
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: TOKEN_UNKNOWN, // will be classified below if possible
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
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
					val: unmatched/* START_DEBUG */,
					pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
				}));
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
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
					val: unmatched/* START_DEBUG */,
					pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
				}));
			}
			if (match) {
				leftContext = chunk.substring(0,next_match_idx - match[0].length);

				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
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
						val: unmatched/* START_DEBUG */,
						pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
					}));
				}
				else {
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token2",new _Grips.tokenizer.Token({
						type: TOKEN_UNKNOWN,
						val: tmp[0]/* START_DEBUG */,
						pos: lineCol(prev_match_idx + tmp.index,fileID)/* STOP_DEBUG */
					})) ||/* STOP_DEBUG */unknown_error;
				}
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: null,
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new _Grips.tokenizer.TokenizerError("Unexpected token",token) ||/* STOP_DEBUG */unknown_error;
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
					val: unmatched/* START_DEBUG */,
					pos: lineCol(prev_match_idx,fileID)/* STOP_DEBUG */
				}));
			}
			if (match) {
				token = new _Grips.tokenizer.Token({
					type: TOKEN_UNKNOWN, // will be classified below if possible
					val: match[0]/* START_DEBUG */,
					pos: lineCol(next_match_idx - match[0].length,fileID)/* STOP_DEBUG */
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
			/* START_DEBUG */tmp, new_line_regex = /\r?\n/g,/* STOP_DEBUG */
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

/* START_DEBUG */
		// initialize the line position tracker
		if (!(fileID in start_of_line_map)) {
			start_of_line_map[fileID] = [0];
		}
/* STOP_DEBUG */

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

/* START_DEBUG */
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
/* STOP_DEBUG */

				// invoke the match handler for current parser state
				res = match_handlers[parser_state]();
				if (res && res !== true) break;
				if (parser_res && parser_res !== true) break;
			}
			else {
				parser_res = /* START_DEBUG */new _Grips.parser.ParserError("Invalid parser state: " + parser_state) ||/* STOP_DEBUG */unknown_error;
				break;
			}
		}

/* START_DEBUG */
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
/* STOP_DEBUG */

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
		/* START_DEBUG */start_of_line_map = {},/* STOP_DEBUG */

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
			/(?:@import(?=\s)|\/\*|\/\/|@\*|::|[~|^$*]\=)|[{("',>+~:\[\]=]/g, /*outside*/
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
/* STOP_COMPILER */
