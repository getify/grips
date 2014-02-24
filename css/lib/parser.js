/* grips-css (c) 2012-2014 Kyle Simpson | http://getify.mit-license.org/ */

/* START_COMPILER */
(function __grips_css_parser__(global,_Grips,_Grips_CSS){

	/* Node */
	function Node(props) {
		for (var i in props) { if (props.hasOwnProperty(i)) {
			this[i] = props[i];
		}}
	}
/* START_DEBUG */
	Node.prototype.toString = function __Node_toString__(includeToken) {
		var ret = "";

		if (this.type === NODE_TEXT) {
			ret = this.val;
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
				node.type = NODE_SELECTOR_BODY;
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
				return /* START_DEBUG */new _Grips.parser.ParserError("Unexpected",token) ||/* STOP_DEBUG */unknown_error;
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
				return /* START_DEBUG */new _Grips.parser.ParserError("Unexpected",token) ||/* STOP_DEBUG */unknown_error;
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
				return /* START_DEBUG */new _Grips.parser.ParserError("Unexpected",token) ||/* STOP_DEBUG */unknown_error;
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
				return /* START_DEBUG */new _Grips.parser.ParserError("Unexpected Text",token) ||/* STOP_DEBUG */unknown_error;
			}
		}

		function handleInsideState(token) {
			var node;

			node = new Node({
				parent: null,
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
				node.type = NODE_SELECTOR_BODY;
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
				node.type = NODE_OPERATOR;
			}
			else if (token.type === _Grips_CSS.tokenizer.DOUBLECOLON) {
				node.type = NODE_OPERATOR;
				node.complete = true;
				delete node.previous_state;
				delete node.children;
			}
			else if (token.type === _Grips_CSS.tokenizer.STAR) {
				node.type = NODE_PREFIX_EXPANDER;
				instance_api.state = NODE_STATE_PREFIX_EXPANSION;
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
				return /* START_DEBUG */new _Grips.parser.ParserError("Unexpected",token) ||/* STOP_DEBUG */unknown_error;
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

			node = new Node({
				parent: current_parent,
				type: NODE_UNKNOWN,
				token: token,
				children: [],
				complete: false,
				previous_state: instance_api.state
			});

			// implicitly ending the prefix expansion state?
			if (token.type === _Grips_CSS.tokenizer.SEMICOLON /*|| // TODO: handle @*
				(
					token.type === _Grips_CSS.tokenizer.BRACE &&
					{brace-count} == 0
				)*/
			) {
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
			else if (token.type === _Grips_CSS.tokenizer.COLON) {
				instance_api.state = NODE_STATE_RULE_VALUE;
				node.type = NODE_OPERATOR;
				current_parent.children.push(node);
				current_parent = node;
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
				return /* START_DEBUG */new _Grips.parser.ParserError("Unexpected",token) ||/* STOP_DEBUG */unknown_error;
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
						return /* START_DEBUG */new _Grips.parser.ParserError("Unexpected",token) ||/* STOP_DEBUG */unknown_error;
					}
				}
			}
		}

		function handleRuleValueState(token) {
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
				return state_handlers[instance_api.state](token);
			}
			else if (token.type === _Grips_CSS.tokenizer.STAR) {
				// TODO: handle nested * if appropriate
				throw "Not Supported Yet";
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
				return /* START_DEBUG */new _Grips.parser.ParserError("Unexpected",token) ||/* STOP_DEBUG */unknown_error;
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
				return /* START_DEBUG */new ParserError("Invalid parser state") ||/* STOP_DEBUG */unknown_error;
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

	function parse(node) {
		var ret, ret2, ret3, err, i;

		// implicitly ending a collection node?
		if (parse_stack.length > 0 &&
			(
				parse_stack[parse_stack.length - 1].type === NODE_UNKNOWN ||
				parse_stack[parse_stack.length - 1].type === NODE_RULE
			)
		) {
			if (node.type === NODE_FILE_MARKER ||
				node.type === NODE_IMPORT_DIRECTIVE
			) {
				// collection node stays "unknown"
				parse_stack[parse_stack.length - 1].complete = true;
				parse_stack.pop();
			}
			else if (node.type === NODE_SELECTOR_BODY) {
				parse_stack[parse_stack.length - 1].type = NODE_SELECTOR;
				parse_stack[parse_stack.length - 1].complete = true;
				parse_stack.pop();
			}
			else if (node.type === NODE_OPERATOR &&
				node.token.type === _Grips_CSS.tokenizer.SEMICOLON
			) {
				if (parse_stack[parse_stack.length - 1].type === NODE_UNKNOWN) {
					parse_stack[parse_stack.length - 1].type = NODE_INCLUDE_RULE;
				}
				parse_stack[parse_stack.length - 1].complete = true;
				parse_stack[parse_stack.length - 1].children.push(node);
				parse_stack.pop();
				return null;
			}
			else if (node.type === NODE_OPERATOR &&
				node.token.type === _Grips_CSS.tokenizer.COLON &&
				parse_stack[parse_stack.length - 1].type === NODE_UNKNOWN
			) {
				parse_stack[parse_stack.length - 1].complete = true;
				parse_stack[parse_stack.length - 1].type = NODE_SELECTOR;
				parse_stack.pop();

				node.type = NODE_RULE;

				parse_stack.push(node);

				node.children.unshift(new Node({
					type: NODE_OPERATOR,
					token: node.token,
					complete: true
				}));

				return node;
			}
			else if (node.type === NODE_OPERATOR &&
				node.token.type === _Grips_CSS.tokenizer.BRACE_CLOSE
			) {
				if (parse_stack[parse_stack.length - 1].type === NODE_UNKNOWN) {
					parse_stack[parse_stack.length - 1].type = NODE_INCLUDE_RULE;
				}
				parse_stack[parse_stack.length - 1].complete = true;
				parse_stack[parse_stack.length - 1].children.push(node);
				parse_stack.pop();
				return null;
			}
			else if (node.type === NODE_OPERATOR &&
				node.token.type === _Grips_CSS.tokenizer.UNKNOWN
			) {
				parse_stack[parse_stack.length - 1].complete = true;
				parse_stack.pop();
				return node;
			}
		}

		if (node.type === NODE_TEXT) {
			// implicitly starting a collection node?
			if (parse_stack.length === 0 ||
				parse_stack[parse_stack.length - 1].type !== NODE_UNKNOWN
			) {
				ret = new Node({
					type: NODE_UNKNOWN,
					token: node.token,
					children: [node],
					complete: false
				});

				parse_stack.push(ret);

				return ret;
			}
			else {
				parse_stack[parse_stack.length - 1].children.push(node);

				return null;
			}
		}
		else if (node.type === NODE_WHITESPACE) {
			if (parse_stack.length === 0 ||
				parse_stack[parse_stack.length - 1].type !== NODE_UNKNOWN
			) {
				return node;
			}
			else {
				parse_stack[parse_stack.length - 1].children.push(node);

				return null;
			}
		}
		else if (node.type === NODE_PREFIX_EXPANDER) {
			if (parse_stack.length === 0 ||
				parse_stack[parse_stack.length - 1].type !== NODE_UNKNOWN
			) {
				ret = new Node({
					type: NODE_SELECTOR,
					token: node.token,
					children: [node],
					complete: false
				});

				parse_stack.push(ret);

				return ret;
			}
			else {
				parse_stack[parse_stack.length - 1].children.push(node);

				return null;
			}
		}
		else if (
			node.type === NODE_SELECTOR ||
			node.type === NODE_SELECTOR_BODY ||
			node.type === NODE_RULE ||
			node.type === NODE_INCLUDE_RULE
		) {
			// do we need to parse the children?
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
		parse_stack = [],
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
		NODE_SELECTOR_BODY = 5,
		NODE_PARAM_LIST = 6,
		NODE_STRING_LITERAL = 7,
		NODE_OPERATOR = 8,
		NODE_PARAM = 9,
		NODE_VARIABLE = 10,
		NODE_SET_PARAMS = 11,
		NODE_WHITESPACE = 12,
		NODE_SELECTOR = 13,
		NODE_RULE = 14,
		NODE_INCLUDE_RULE = 15,
		NODE_UNKNOWN = 16,

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
		SELECTOR_BODY: NODE_SELECTOR_BODY,
		PARAM_LIST: NODE_PARAM_LIST,
		STRING_LITERAL: NODE_STRING_LITERAL,
		OPERATOR: NODE_OPERATOR,
		PARAM: NODE_PARAM,
		VARIABLE: NODE_VARIABLE,
		SET_PARAMS: NODE_SET_PARAMS,
		WHITESPACE: NODE_WHITESPACE,
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
/* STOP_COMPILER */
