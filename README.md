# grips Templating Engine

**NOTE: this project used to be called "HandlebarJS". To avoid confusion with the newer but more popular "Handlebars" templating engine from @wycats, I'm renaming this project to "grips".**

grips is a simple templating engine written in JavaScript. It's designed to work either/both in the browser or on the server, with the same code-base and the same template files.

grips takes as its only input data in a simple JSON data-dictionary format, and returns output from the template(s) selected.

grips will "compile" requested templates into executable JavaScript functions, which take the JSON data dictionary as input and return the output. The compilation of templates can either be JIT (at request time) or pre-compiled in a build process.

## Examples

The examples/ directory has several sample template files. Some are out of date still, so look at "test.html" for now.

## Templating sytax

### Define a named template section (aka, "partial")

	{$: "#xxx" }
	
		...
	
	{$}

### Define a named template section, with local variable assignment(s)

	{$: "#xxx" | x = $.val_1 | y = $.val_2 ? "#yyy" : "#zzz" }
	
		...
	
	{$}

### Include data variable

	{$= $.val_1 $}

### Include template section

	{$= @"#yyy" $}

### Include template section from data variable

	{$= @value $}

### Loop on data variable (array or plain key/value object)

	{$* $.val_1 }
	
		...
	
	{$}

### Loop on data variable, with loop iteration local variable assignment(s)
  `$$` iteration binding includes: 
    `index` (numeric), `key` (string: property name or index),
    `value`, `first`, `last`, `odd`, and `even`

	{$* $.val_1 | rowtype = $$.odd ? "#oddrow" : "#evenrow" | 
	     someprop = $$.value.someProp ? "#hassomeprop" }
	
		...
		{$= @rowtype $}
		...
		{$= @someprop $}
		...
		{$= $$.value.otherProp $}
		...
	
	{$}

### "Extend" (inherit from) another template collection

	{$+ "collection-id-or-filename" $}

### Raw un-parsed section

	{$%
	
		{$= won't be parsed, just passed through raw $}
	
	%$}

### Template comment block

	{$/
	
		will get removed in parsing
	
	/$}

## Using the API

(coming soon)

## Building

grips comes with a node JavaScript tool called "build", in the root directory, which when run will generate the files you need to use grips, in a directory called "deploy".

There are several options for the build tool:

```
build tool for grips templating engine
(c) 2012 Kyle Simpson | http://getify.mit-license.org/

usage: build [opt, ...]

options:
--help       show this help
--verbose    display progress
--all        build all options (ignores --runtime and --nodebug)
--runtime    builds only the stripped down runtime (no compiler)
--nodebug    strip debug code (smaller files with less graceful error handling)
--minify     all minify all built files with uglify.js (creates *.min.js files)
```

By default, the build tool is silent, meaning it outputs nothing to the console unless there are errors. If you'd like verbose output, pass the `--verbose` flag. Unless you pass the `--runtime` or `--all` flags, the build tool will generate both the "full" compiler and the base runtime. `--all` overrides/ignores `--runtime` (and `--nodebug`).

Also by default, the build tool will generate only the debug versions of the files. For production use, pass the `--nodebug` flag, and the debug code will be stripped. Or, pass the `--all` flag and both debug and non-debug files will be built.

To also produce the minified versions of all files being built (suitable for production deployment), pass the `--minify` flag. Note: to use minification, the node.js "uglify-js" package should be installed (via npm). (`npm install 'uglify-js'`)

## License

grips (c) 2012 Kyle Simpson | http://getify.mit-license.org/
