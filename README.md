# grips Templating Engine

**NOTE: this project used to be called "HandlebarJS". To avoid confusion with the newer but more popular "Handlebars" templating engine from @wycats, I'm renaming this project to "grips".**

grips is a simple templating engine written in JavaScript. It's designed to work either/both in the browser or on the server, with the same code-base and the same template files.

grips takes as its only input data in a simple JSON data-dictionary format, and returns output from the template(s) selected.

grips will "compile" requested templates into executable JavaScript functions, which take the JSON data dictionary as input and return the output. The compilation of templates can either be JIT (at request time) or pre-compiled in a build process.

## Examples

The examples/ directory has several sample template files. Take a look at "tmpl.master.html" and "tmpl.index.html" in particular for good general real-world looking examples. "test.html" is more esoteric and shows off more complexities of the syntax nuances.

## Templating sytax

### Define a named template section (aka, "partial")

	{$: "#xxx" }
		...
		...
	{$}

### Define a named template section (partial), with local variable assignment(s)
  `$` is the data object (context) passed into the partial.

	{$: "#xxx" |
		x = $.val_1 |
		y = $.val_2 ? "#yyy" : "#zzz"
	}
		...
		...
	{$}

### Conditional Assignments

	{$: "#bar" |
		baz = $.baz ? "yes" : ""
	}
		baz: {$= baz $}
	{$}

  Also, the `else` condition of a conditional can be omitted and defaults to `""`.

	{$: "#bar" |
		baz = $.baz ? "yes"
	}
		baz: {$= baz $}
	{$}

### Include data variable

	{$= $.val_1 $}  <!-- OR -->  {$= myval $}

### Include template partial, by static literal

	{$= @"#yyy" $}

### Include template partial, by variable

	{$= @$.val_1 $}  <!-- OR -->  {$= @myval $}

### Manually specify data context for template partial include

	{$= @"#yyy" | $.user $}

### Loop on data variable (array or plain key/value object)
  `$$` iteration binding includes: 
    `index` (numeric), `key` (string: property name or index),
    `value`, `first`, `last`, `odd`, and `even`

	{$* $.val_1 }
		...
		{$= $$.value $}  <!-- include the loop iteration value -->
		...
	{$}

### Loop on data variable, with loop iteration local variable assignment(s)

	{$* $.val_1 |
		rowtype = $$.odd ? "#oddrow" : "#evenrow" | 
	    someprop = $$.value.someProp ? "#hassomeprop"
	}
		...
		{$= @rowtype $}  <!-- include local variable -->
		...
		{$= @someprop $}
		...
		{$= $$.value.otherProp $}  <!-- include loop iteration value variable -->
		...
	{$}

### Range Literals

    {$* [2..7] } <!-- let's count from 2 to 7 -->
    	counting: {$= $$.value $}
    {$}

    {$* [4..-3] } <!-- count down from 4 to -3 -->
    	counting: {$= $$.value $}
    {$}

### Set Literals

    {$* ["Jan", "Feb", "Mar"] } <!-- show the months in Q1 -->
    	month: {$= $$.value $}
    {$}

### Precomputing hash literals
  Hash literals can be pre-computed against a defined set or range of values. In the below examples, the value of `$.myradio` will be compared to all values in the range/set (0,1,2 or "low","medium","high"). The results of the comparison and conditional assignment are stored in a local variable hash, keyed by the comparison values. For instance, in the below example, on of the three pre-computation comparisons/assignments the syntax implies is: `checked[1] = ($.myradio === 1) ? "checked" : ""` (same for values 0 and 2, as well).

	{$: "#bar" |
		checked[0..2] = $.myradio ? "checked"
	}
		<input type="radio" name="myradio" value="0" {$= checked[0] $}>
		<input type="radio" name="myradio" value="1" {$= checked[1] $}>
		<input type="radio" name="myradio" value="2" {$= checked[2] $}>
	{$}

  Using a loop the above can be even more terse:

	{$: "#bar" |
		checked[0..2] = $.myradio ? "checked"
	}
		{$* [0..2] }
			<input type="radio" name="myradio" value="{$= $$.value $}" {$= checked[$$.value] $}>
		{$}
	{$}

  Here's pre-computed against a set-literal:

	{$: "#bar" |
		checked["low","medium","high"] = $.myradio ? "checked"
	}
		<input type="radio" name="myradio" value="low" {$= checked["low"] $}>
		<input type="radio" name="myradio" value="medium" {$= checked["medium"] $}>
		<input type="radio" name="myradio" value="high" {$= checked["high"] $}>
	{$}

### "Extend" (inherit from) another template collection

	{$+ "collection-id-or-filename" $}

### Raw un-parsed section

	{$%
		this stuff {$= won't be parsed $}, just passed through raw
	%$}

### Template comment block

	{$/
		comments get removed in parsing
	/$}

## Debug vs. Non-Debug

grips can either be used in debug mode or non-debug mode, controlled by which version of the library file/module you include. The debug version of the library has friendly error handling, and also produces compiled templates with friendly error handling, whereas the non-debug library (and templates compiled by it) will simply throw a generic "Unknown error" for any errors encountered.

It is recommended that during development you use the debug version of the library, as it will greatly assist in understanding grips template syntax and behavior. But once you deploy grips and/or compiled templates to production, use the non-debug version of the library, because both the library and the compiled templates will be significantly smaller with debug bits stripped.

For browser usage (either basic or AMD-style), choose the appropriate file with or without the "-debug" in the filename. For node.js module usage, you select which version of the library you want to use directly on the included module.

```
var grips_nondebug = require("grips").grips;
var grips_debug = require("grips").debug;
```

## Full Compiler vs. Runtime

For browser usage (either basic of AMD-style), you can choose to include the full compiler, or just the runtime bits. The runtime is all that's required if you only plan to render pre-compiled templates. If you need to actually compile templates in the browser (usually pretty rare), include the full lib. Otherwise, you should include the **much smaller** runtime only.

The most typical production usage pattern would be to have a build process (see the `grips` CLI tool section below) that precompiles your templates, and includes them all together in a single script file (ex: "template-bundle.js"). In that scenario, you'd most likely want to **prepend** the runtime library file to the **beginning** of that template bundle file, so you'd only need to load that one combined file in the browser.

## Installing, Deploying

If you plan to use grips only in a browser, simply download the appropriate file(s) from the "deploy" directory of this repository, and use them in your page using a standard `<script src="...">` type include, bundle the file(s) with your other code, or load them with a dynamic script loader or dependency manager.

If you plan to use grips on the server (in node.js), install it with npm:

```
npm install grips
```

If you want to use the "grips" CLI tool and the "grips-build" build tool from your command line, and you want those binaries added to your normal system bin path, you can instead install grips globally, by adding a "-g" to your `npm install` command.

Once installed with npm, you will have a "./node_modules/grips/deploy" directory, and there is where you will find the files you need to deploy for browser usage, as just described.

To use the grips module in a node.js script, you simply call `require("grips")`, and on that module object, you choose either the debug version of the library with `require("grips").debug` or the non-debug version with `require("grips").grips`.

## Using the JavaScript API

The JavaScript API is accessible in a couple of different ways. The raw library can be loaded in a traditional fashion in a browser, and will produce a single global called "grips". It can be loaded as an AMD module, using the "amd-*.js" versions of the files (assuming they were built with the "build" tool). And finally, you can use the "node-grips" and "node-grips-debug" modules in node.js code, with standard `require()` inclusion (`var grips = require("grips").grips;`).

Regardless of how you include the library and get access to the core `grips` API, the following methods and signatures are all available. The only caveat is that if you load the runtime version of the library (which has the compiler stripped), only the runtime parts (`initialize`, `render`, etc) of the API are available.

The two most typical tasks for the JavaScript API are `compileCollection()` and `render()`.

"grips" organizes template partials by grouping them together in collections. A single collection is an arbitrary grouping of one or more partials, but it usually will correspond to a single template file. The collection ID is arbitrary, but again, will usually be the filename of the template file.

You can render an individual partial, but you compile a collection of one or more partials.

### Compiling a collection
To compile a collection of partials, call `compileCollection(templateStr, collectionID,[initialize=true])`. 

`templateStr` is the string representation of your collection of template partials. `collectionID` should be the same as any other references to the collection by ID, such as other absolute template includes, or template extend directives, in other collections.

`initialize`, which defaults to true, is an optional boolean flag. If `true`, it will evaluate the compiled template function representation, so that it's ready to render. `compileCollection()` also returns you the string value of that compiled template function, so you can choose to store it in a file during a build process, etc.

A collection ID is the first part of a canonical template ID (`foo` in `"foo#bar"`, whereas `#bar` is the partial ID). For example, the `{$+ ... $}` collection extend tag takes only the collection ID (without any `#bar` partial ID).

```
grips.compileCollection("{$: '#bar' } Hello {$= $.name $}! {$}", "foo");
```

For convenience, if you want to compile several collections at once, use `compile(sources, [initialize=true])`. `sources` is an object whose keys are collection names and values are collection template sources.

```
grips.compile({
	foo: "{$: '#bar' } Hello {$= $.name $}! {$}"
});
```

### Rendering a partial
In an environment where one or more collections have been built (aka, interpreted/executed), they can be rendered by calling `render(templateID, data)`.

To render a partial, you refer canonically to its `templateID` by both the partial ID and the collection in which it lives. For example: `"foo#bar"`, where `foo` is the collection ID and `#bar` is the partial ID.

```
var markup = grips.render("foo#bar", {name: "World"});
```

### Other methods
Since you can pre-compile templates during a build process and store them in files for later use in production, you can call `initializeCollection()` (or `initialize()`) to evaluate a compiled template function's source retrieved from a file.

For instance, if you had the compiled functions for the `foo` collection in source form (from a file), you can evaluate them (so they're ready for rendering) by either `eval()`ing them yourself, or with `initializeCollection(collectionID, compiledSource)`.

```
eval(fooCompiledSource);

// or, better:

grips.initializeCollection("foo", fooCompiledSource);
```

And if you have all your collections in one big string, you can just call `initialize(compiledSourceBundle)`.

```
eval(compiledSource);

// or, better:

grips.initialize(compiledSource);
```

## Using the grips CLI

grips comes with a node.js tool called "grips" (I know, creative, right!?), in the "bin/" directory, which is a CLI tool for compiling, initializing, and rendering templates.

Here are the options for the CLI tool:

```
usage: grips opt [, ..opt]

options:
--help                                    show this help

--nodebug                                 use the non-debug library
--keep-paths                              for --compile, keep the full path in the collection ID, instead of just the filename
--minify                                  minify compiled templates with uglify.js

--compile=file                            compile a template file (using {file} as the collection ID)
--initialize=file                         initializes an already compiled template collection from a file
--render='{collection-ID}#{partial-ID}'   render the specified partial, using data from stdin
```

The `--compile` flag can be passed multiple times, once for each file you want to compile. By default, only the filename itself will be used as the collection ID, however if you pass `--keep-paths`, then the full path you specify for a file will be used as the collection ID. NOTE: a collection ID, filename, file path must not include a `#` character, as that is the separator between collection ID and partial ID.

If a `--render` flag is not passed, the output from the compilation (`--compile`) will be printed to the stdout. Otherwise, the output will be the rendered output.

If you want to initialize (to prepare for rendering) an already compiled collection (in one or more files), use `--initialize`.

If you have compiled templates, or initialized already compiled templates, then you can render one or more partials using `--render`. You must specify both the collection ID and the partial ID. `--render` also requires that you provide the JSON data for your template rendering via stdin.

```
bin/grips --compile=templates/foo.bar.html --compile=templates/baz.html > tmpl-bundle.js
echo "{\"some\":\"data\"}" | bin/grips --initialize=tmpl-bundle.js --render='baz.html#foobar'
..
echo "{\"some\":\"data\"}" | bin/grips --compile=templates/foo.bar.html --compile=templates/baz.html --render= 'baz.html#foobar'
```

## Building grips

grips comes with a node.js tool called "build", in the "bin/" directory, which when run will generate the files you need to use grips, in a directory called "deploy".

There are a few simple options for the build tool:

```
usage: build [opt, ...]

options:
--help       show this help
--verbose    display progress
--all        build all options (ignores --runtime and --nodebug)
--runtime    builds only the stripped down runtime (no compiler)
--amd        also build AMD style files (amd-*.js)
--node       build the node.js compatible package (in a /bin folder)
--nodebug    strip debug code (smaller files with less graceful error handling)
--minify     minify all built files with uglify.js (creates *.min.js files)
```

By default, the build tool is silent, meaning it outputs nothing to the console unless there are errors. If you'd like verbose output, pass the `--verbose` flag. Unless you pass the `--runtime`, the build tool will generate both the "full" compiler and the base runtime. `--all` overrides/ignores `--runtime` (and `--nodebug`).

Also by default, the build tool will generate only the debug versions of the files (with extra/verbose error handling, etc). For production use, pass the `--nodebug` flag, and the debug code will be stripped. Or, pass the `--all` flag and both debug and non-debug files will be built.

To also produce the minified versions of all files being built (suitable for production deployment), pass the `--minify` flag. Note: to use minification, the node.js "uglify-js" package should be installed (via npm). (`npm install 'uglify-js'`)

Passing `--node` will build the node.js compatible modules "node-grips" and "node-grips-debug" (which are used by the CLI, btw), in a directory called "bin".

## License

grips (c) 2012 Kyle Simpson | http://getify.mit-license.org/
