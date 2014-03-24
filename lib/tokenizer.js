/* grips (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/ */

/* START_COMPILER */
(function __grips_tokenizer__(global,_Grips){

	/* Token */
	function Token(props) {
		for (var i in props) { if (props.hasOwnProperty(i)) {
			this[i] = props[i];
		}}
	}
/* START_DEBUG */
	Token.prototype.toString = function __Token_toString__() {
		return "`" + this.val + "`; line: " + this.pos.line + " position: " + this.pos.col + "; token-type: " + this.type;
	};

	// translate raw char position into line/column mapping
	function lineCol(rawPos,collectionID) {
		rawPos = Math.max(0,rawPos);
		var i, ret = { raw:rawPos, line:1, col:rawPos };

		for (i=0; i<start_of_line_map[collectionID].length; i++) {
			if (start_of_line_map[collectionID][i] > rawPos) {
				break;
			}
			ret.line = i + 1; // line numbers are 1-based
			ret.col = rawPos - start_of_line_map[collectionID][i];
		}

		return ret;
	}

	/* TokenizerError */
	var TokenizerError = (function TokenizerError() {
		function F(){}
		function CustomError(msg,token) {
			// correct if not called with "new"
			var self = (this===global) ? new F() : this;
			self.message = msg;
			self.token = token;
			return self;
		}
		F.prototype = CustomError.prototype = Object.create(SyntaxError.prototype);
		CustomError.prototype.constructor = CustomError;

		CustomError.prototype.toString = function __TokenizerError_toString__() {
			return "TokenizerError: " + this.message + "; " + this.token.toString().replace(/[\n\r]+/g," ").replace(/\s+/g," ");
		};
		return CustomError;
	})();
/* STOP_DEBUG */

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
					val: unmatched/* START_DEBUG */,
					pos: lineCol(prev_match_idx,collectionID)/* STOP_DEBUG */
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
							val: match[0]/* START_DEBUG */,
							pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
						}));
					}
					// start of tag?
					else if (match[0] === "{$") {
						token = new Token({
							type: TOKEN_TAG_OPEN,
							val: match[0]/* START_DEBUG */,
							pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
						});
						tokens.push(token);
						// look ahead to the tag-type signifier, if any
						if ((next_match_idx < chunk.length - 1) &&
							(match = chunk.substr(next_match_idx).match(/^(?:(?:~|escape\s+)[hsuHSU]+|[~:+=*\/%#]|(?:(?:define|extend|insert|print|partial|loop|let|comment|raw|escape)\b))/))
						) {
							tokens.push(new Token({
								type: TOKEN_TAG_SIGNIFIER,
								val: match[0]/* START_DEBUG */,
								pos: lineCol(next_match_idx,collectionID)/* STOP_DEBUG */
							}));
							next_match_idx += match[0].length;
						}
						else {
							return /* START_DEBUG */new _Grips.parser.ParserError("Expected Tag type-signifier",new Token({
								type: TOKEN_GENERAL,
								val: chunk.substr(next_match_idx,1),
								pos: lineCol(next_match_idx,collectionID)
							})) ||/* STOP_DEBUG */unknown_error;
						}
					}
					// unexpected/unrecognized token, bail
					else {
						return /* START_DEBUG */new TokenizerError("Unrecognized token",new Token({
							type: TOKEN_TAG_UNKNOWN,
							val: match[0],
							pos: lineCol(next_match_idx - match[0].length,collectionID)
						})) ||/* STOP_DEBUG */unknown_error;
					}
				}
				// otherwise, since it was escaped, treat the match as just a general token
				else {
					tokens.push(new Token({
						type: TOKEN_GENERAL,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
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
					return /* START_DEBUG */new TokenizerError("Unrecognized token",new Token({
						type: TOKEN_GENERAL,
						val: tmp[0],
						pos: lineCol(prev_match_idx + tmp.index,collectionID)
					})) ||/* STOP_DEBUG */unknown_error;
				}
				else {
					tokens.push(new Token({
						type: TOKEN_GENERAL,
						val: unmatched/* START_DEBUG */,
						pos: lineCol(prev_match_idx,collectionID)/* STOP_DEBUG */
					}));
				}
			}
			if (match) {
				if (match[0] === "$}") {
					tokens.push(new Token({
						type: TOKEN_TAG_SIMPLE_CLOSE,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
					}));
				}
				else if (match[0] === "}") {
					tokens.push(new Token({
						type: TOKEN_TAG_BLOCK_HEAD_CLOSE,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
					}));
				}
				else if (/^\s+$/.test(match[0])) {
					tokens.push(new Token({
						type: TOKEN_TAG_WHITESPACE,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
					}));
					// whitespace can't change the state of the parser, so skip the parse step for now
					return;
				}
				else if (/^["']$/.test(match[0])) {
					token = new Token({
						type: 0,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
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
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
					}));
				}
				else if (match[0] === "|") {
					tokens.push(new Token({
						type: TOKEN_TAG_PIPE,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
					}));
				}
				else if (match[0] === "@") {
					tokens.push(new Token({
						type: TOKEN_TAG_AT,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
					}));
				}
				else if (/^~[hsuHSU]*$/.test(match[0])) {
					tokens.push(new Token({
						type: TOKEN_TAG_TILDE,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
					}));
				}
				else {
					tokens.push(new Token({
						type: TOKEN_GENERAL,
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
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
					val: ""/* START_DEBUG */,
					pos: lineCol(prev_match_idx,collectionID)/* STOP_DEBUG */
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
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
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
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
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
					val: ""/* START_DEBUG */,
					pos: lineCol(prev_match_idx,collectionID)/* STOP_DEBUG */
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
						val: match[0]/* START_DEBUG */,
						pos: lineCol(next_match_idx - match[0].length,collectionID)/* STOP_DEBUG */
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
			/* START_DEBUG */tmp, new_line_regex = /\r?\n/g,/* STOP_DEBUG */
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

/* START_DEBUG */
		// initialize the line position tracker
		if (!(collectionID in start_of_line_map)) {
			start_of_line_map[collectionID] = [0];
		}
/* STOP_DEBUG */

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

/* START_DEBUG */
				// keep track of where lines are, for debugging purposes
				if (unmatched) {
					new_line_regex.lastIndex = 0; // reset global regex to avoid caching bugs
					while ((tmp = new_line_regex.exec(unmatched))) {
						start_of_line_map[collectionID].push(prev_match_idx + tmp.index + tmp[0].length);
					}
				}

				new_line_regex.lastIndex = 0;
				while ((tmp = new_line_regex.exec(match))) {
					start_of_line_map[collectionID].push(prev_match_idx + unmatched.length + tmp.index + tmp[0].length);
				}
/* STOP_DEBUG */

				// invoke the match handler for current parser state
				res = match_handlers[parser_state]();
				if (res && res !== true) break;
				if (parser_res && parser_res !== true) break;
			}
			else {
				parser_res = /* START_DEBUG */new _Grips.parser.ParserError("Invalid parser state") ||/* STOP_DEBUG */unknown_error;
				break;
			}
		}

/* START_DEBUG */
		if (res instanceof TokenizerError ||
			res instanceof _Grips.parser.ParserError
		) {
			throw res;
		}
		if (parser_res instanceof TokenizerError ||
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

/* START_DEBUG */
		lineCol: lineCol,
		TokenizerError: TokenizerError,
/* STOP_DEBUG */

		Token: Token
	};

})(this,this.grips);
/* STOP_COMPILER */
