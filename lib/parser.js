(function(global){

	/* Node */
	Node = function(props) {
		for (var i in props) { if (props.hasOwnProperty(i)) {
			this[i] = props[i];
		}}
	};
	Node.prototype.toString = function() { return JSON.stringify(this); };

	/* ParserError */
	var ParserError = (function() {
		function F(){}
		function CustomError(msg,ref) {
			// correct if not called with "new"
			var self = (this===window) ? new F() : this;
			self.message = msg;
			self.ref = ref;
			return self;
		}
		F.prototype = CustomError.prototype = Object.create(SyntaxError.prototype);
		CustomError.prototype.constructor = CustomError;

		CustomError.prototype.toString = function() {
			var ref_str = "";
			if (this.ref) {
				if (this.ref instanceof global.grips.tokenizer.Token) {
					ref_str = " at position " + this.ref.pos + "\n" + this.ref.toString();
				}
				else if (this.ref instanceof Node) {
					ref_str = " at position " + this.ref.token.pos + "\n" + JSON.stringify(this.ref);
				}
				else {
					ref_str = "\n" + this.ref;
				}
			}
			return "ParserError: " + this.message + ref_str;
		};
		return CustomError;
	})();


	function nodify(tokens,filename) {
		function handleOutsideState(token) {
			if (token.type === global.grips.tokenizer.OPEN) {
				node = new Node({
					parent: null,
					type: null,
					token: token,
					decl: [],
					children: []
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
			else if (token.type === global.grips.tokenizer.GENERAL) {
				node = new Node({
					parent: null,
					type: NODE_TEXT,
					token: token
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
			else if (current_parent && token.type === global.grips.tokenizer.WHITESPACE) {
				node = new Node({
					parent: current_parent,
					type: NODE_TEXT,
					token: token
				});
				current_parent.children.push(node);
			}
			else if (token.type === global.grips.tokenizer.BLOCK_FOOTER) {
				if (current_parent && current_parent.close_header === global.grips.tokenizer.BLOCK_HEAD_CLOSE) {
					current_parent = current_parent.parent;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new ParserError("Unexpected Tag",token);
				}
			}
		}

		function handleInsideState(token) {
			if (token.type === global.grips.tokenizer.SIGNIFIER) {
				if (current_parent && current_parent.type == null) {
					if (token.val === ":") current_parent.type = NODE_TAG_DEFINE;
					else if (token.val === "+") current_parent.type = NODE_TAG_EXTEND;
					else if (token.val === "=") current_parent.type = NODE_TAG_INCL_VAR; // NOTE: can later be re-defined to NODE_TAG_INCL_TMPL if `@` is found subsequently
					else if (token.val === "*") current_parent.type = NODE_TAG_LOOP;
					else if (token.val === "%") current_parent.type = NODE_TAG_RAW;
					else if (token.val === "/") current_parent.type = NODE_TAG_COMMENT;

					// special handling for various tag types
					if (current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_INCL_VAR
					) {
						current_parent.close_header = global.grips.tokenizer.SIMPLE_CLOSE;
						delete current_parent.children; // these tag types don't have `children`
					}
					else if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_LOOP
					) {
						current_parent.close_header = global.grips.tokenizer.BLOCK_HEAD_CLOSE;
					}
					else if (current_parent.type === NODE_TAG_RAW) {
						current_parent.val = "";
						instance_api.state = NODE_STATE_RAW;
						delete current_parent.decl; // raw tags don't have a declaration
					}
					else if (current_parent.type === NODE_TAG_COMMENT) {
						current_parent.val = "";
						instance_api.state = NODE_STATE_COMMENT;
						delete current_parent.decl; // comment tags don't have a declaration
						delete current_parent.children; // comment tags don't have `children`
					}

					// is top-level tag that's invalid?
					if (current_parent.parent == null &&
						!(
							current_parent.type === NODE_TAG_EXTEND ||
							current_parent.type === NODE_TAG_DEFINE ||
							current_parent.type === NODE_TAG_COMMENT
						)
					) {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Unexpected Tag",current_parent);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.WHITESPACE) {
				if (current_parent) {
					if (current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_INCL_VAR ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_DEFINE_EXPR
					) {
						// is this node's declaration already in progress?
						if (current_parent.decl.length > 0) {
							// keep the whitespace node (could be relevant)
							current_parent.decl.push(new Node({
								parent: current_parent,
								type: NODE_WHITESPACE,
								token: token
							}));
						}
						// otherwise, ignore the whitespace node
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
					}
				}
				// NOTE: we ignore whitespace tokens if they're not inside a tag (parent)
			}
			// redefine include as a template-include?
			else if (token.type === global.grips.tokenizer.AT) {
				if (current_parent && 
					current_parent.type === NODE_TAG_INCL_VAR &&
					current_parent.decl.length === 0 // is the node's declaration not yet defined?
				) {
					current_parent.type = NODE_TAG_INCL_TMPL;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (
				token.type === global.grips.tokenizer.SINGLE_QUOTE ||
				token.type === global.grips.tokenizer.DOUBLE_QUOTE
			) {
				if (current_parent && 
					(
						current_parent.type === NODE_TAG_EXTEND ||
						current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_INCL_VAR ||
						current_parent.type === NODE_TAG_LOOP ||
						current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_DEFINE_EXPR
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
					if (!current_parent.id &&
						(
							current_parent.type === NODE_TAG_DEFINE ||
							current_parent.type === NODE_TAG_EXTEND
						)
					) {
						current_parent.id = node;
						node.type = NODE_ID;
					}
					else {
						node.type = NODE_LITERAL_EXPR;
					}

					current_parent.decl.push(node);
					current_parent = node;
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.OPERATOR) {
				if (current_parent &&
					(
						current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_DEFINE_EXPR
					)
				) {
					current_parent.decl.push(new Node({
						parent: current_parent,
						type: NODE_TEXT,
						token: token,
						val: token.val
					}));
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.PIPE) {
				if (current_parent) {
					// is this PIPE delimiting a previous EXPR node?
					if (current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_DEFINE_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id && 
						(
							current_parent.type === NODE_TAG_DEFINE ||
							current_parent.type === NODE_TAG_EXTEND
						)
					) {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Expected #id for Tag",current_parent);
					}
					if (current_parent.type === NODE_TAG_DEFINE ||
						current_parent.type === NODE_TAG_LOOP
					) {
						node = new Node({
							parent: current_parent,
							type: NODE_EXPR,
							token: null,
							decl: []
						});
						current_parent.decl.push(node);
						current_parent = node;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.SIMPLE_CLOSE) {
				if (current_parent) {
					// do we need to close the current EXPR node?
					if (current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_DEFINE_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id && current_parent.type === NODE_TAG_EXTEND) {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Expected #id for Tag",current_parent);
					}

					if (current_parent.close_header === global.grips.tokenizer.SIMPLE_CLOSE) {
						instance_api.state = NODE_STATE_OUTSIDE;
						current_parent = current_parent.parent;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Unexpected Tag closure",token);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.BLOCK_HEAD_CLOSE) {
				if (current_parent) {
					// do we need to close the current EXPR node?
					if (current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_DEFINE_EXPR
					) {
						current_parent = current_parent.parent;
					}

					// did we fail to see a Tag ID where one is expected?
					if (!current_parent.id && current_parent.type === NODE_TAG_DEFINE) {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Expected #id for Tag",current_parent);
					}

					if (current_parent.close_header === global.grips.tokenizer.BLOCK_HEAD_CLOSE) {
						instance_api.state = NODE_STATE_OUTSIDE;
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Unexpected Tag closure",token);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new global.grips.tokenizer.TokenizerError("Unexpected token",token);
				}
			}
			else if (token.type === global.grips.tokenizer.GENERAL) {
				if (current_parent) {
					// do we need to implicitly switch to EXPR processing for this tag?
					if (current_parent.type === NODE_TAG_INCL_VAR ||
						current_parent.type === NODE_TAG_INCL_TMPL ||
						current_parent.type === NODE_TAG_LOOP
					) {
						node = new Node({
							parent: current_parent,
							type: null,
							token: null,
							decl: []
						});

						// main EXPR in a LOOP tag?
						if (current_parent.type === NODE_TAG_LOOP &&
							current_parent.decl.length === 0
						) {
							current_parent.main_expr = node;
							node.type = NODE_DEFINE_EXPR;
						}
						// main EXPR in an INCL tag?
						else if (current_parent.type === NODE_TAG_INCL_VAR ||
							current_parent.type === NODE_TAG_INCL_TMPL
						) {
							current_parent.main_expr = node;
							node.type = NODE_DEFINE_EXPR;
						}
						// otherwise, just an additional EXPR
						else {
							node.type = NODE_EXPR;
						}

						current_parent.decl.push(node);
						current_parent = node;
					}

					if (current_parent.type === NODE_EXPR ||
						current_parent.type === NODE_DEFINE_EXPR 
					) {
						current_parent.decl.push(new Node({
							parent: current_parent,
							type: NODE_TEXT,
							token: token,
							val: token.val
						}));
					}
					else {
						instance_api.state = NODE_STATE_INVALID;
						return new ParserError("Unexpected token",token);
					}
				}
				else {
					instance_api.state = NODE_STATE_INVALID;
					return new ParserError("Unexpected token",token);
				}
			}
		}

		function handleRawState(token) {
			if (token.type === global.grips.tokenizer.GENERAL) {
				// if this raw node's token isn't yet assigned, this current token should be it
				if (current_parent.token.type !== global.grips.tokenizer.GENERAL) {
					current_parent.token = token;
				}

				current_parent.val += token.val;
			}
			else if (token.type === global.grips.tokenizer.RAW_CLOSE) {
				current_parent = current_parent.parent;
				instance_api.state = NODE_STATE_OUTSIDE;
			}
			else {
				return new ParserError("Unexpected token",token);
			}
		}

		function handleCommentState(token) {
			if (token.type === global.grips.tokenizer.COMMENT_CLOSE) {
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

		function handleLiteralState(token) {
			if (token.type === global.grips.tokenizer.GENERAL) {
				// if this literal node's token isn't yet assigned, this current token should be it
				if (current_parent.token.type !== global.grips.tokenizer.GENERAL) {
					current_parent.token = token;
				}

				// is the literal a Define Tag ID that should have a filename in it, but doesn't?
				if (current_parent.val === "" &&
					current_parent.parent.type === NODE_TAG_DEFINE &&
					token.val.match(/^#/)
				) {
					current_parent.val += filename; // canonicalize the Tag ID with the filename
				}

				current_parent.val += token.val;
			}
			else if (
				(
					token.type === global.grips.tokenizer.SINGLE_QUOTE ||
					token.type === global.grips.tokenizer.DOUBLE_QUOTE
				) &&
				current_parent.delimiter === token.val
			) {
				current_parent = current_parent.parent;
				instance_api.state = NODE_STATE_INSIDE;
			}
			else {
				return new ParserError("Unexpected token",token);
			}
		}


		var idx, node, res,
			state_handlers = [
				handleOutsideState,
				handleInsideState,
				handleRawState,
				handleCommentState,
				handleLiteralState
			]
		;

		for (idx=0; idx<tokens.length; idx++) {
			if (instance_api.state === NODE_STATE_INVALID) {
				return new ParserError("Invalid parser state");
			}

			// invoke the parser state handler
			res = state_handlers[instance_api.state](tokens[idx]);
			if (res) return res;
		}

		return true;
	}

	function parse(node) {
		function validateTagID(node,notOnly) {
			var tmp;
			if (!node || !node.val || !node.val.match(/#[a-z0-9_\-$]+$/i)) return new ParserError("Expected #id for Tag",node);
			if ((tmp = node.val.match(/#/g)) && tmp.length > 2) return new ParserError("Expected only one #id for Tag",node);
			if (notOnly && node.val.match(/^#/)) return new ParserError("Expected filename in Tag ID",node);
		}

		var err;

		if (node.type === NODE_TAG_EXTEND) {
			if (~node.id.val.indexOf("#") && (err = validateTagID(node.id,/*notOnly=*/true))) {
				throw err;
			}
		}
		if (node.type === NODE_TAG_DEFINE) {
			if (~node.id.val.indexOf("#") && (err = validateTagID(node.id))) {
				throw err;
			}
		}
	}

	function parseNextNode() {
		if (node_idx < nodes.length) {
			return parse(nodes[node_idx++]);
		}
	}

	var nodes = [],
		current_parent,
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
		NODE_TAG_INCL_VAR = 4,
		NODE_TAG_LOOP = 5,
		NODE_TAG_RAW = 6,
		NODE_TAG_COMMENT = 7,
		NODE_ID = 8,
		NODE_EXPR = 9,
		NODE_DEFINE_EXPR = 10,
		NODE_LITERAL_EXPR = 11,
		NODE_WHITESPACE = 12,

		instance_api
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
		TAG_INCL_VAR: NODE_TAG_INCL_VAR,
		TAG_LOOP: NODE_TAG_LOOP,
		TAG_RAW: NODE_TAG_RAW,
		TAG_COMMENT: NODE_TAG_COMMENT,
		ID: NODE_ID,
		EXPR: NODE_EXPR,
		DEFINE_EXPR: NODE_DEFINE_EXPR,
		LITERAL_EXPR: NODE_LITERAL_EXPR,
		WHITESPACE: NODE_WHITESPACE,

		state: NODE_STATE_OUTSIDE,

		nodify: nodify,
		parseNextNode: parseNextNode,

		dump: function() { return nodes; },

		Node: Node,
		ParserError: ParserError
	};

	global.grips.parser = instance_api;

})(this);