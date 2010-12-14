HandlebarJS Templating Engine
v0.0.1.2 (c) 2010 Kyle Simpson
MIT License


HandlebarJS is a simple templating engine written in JavaScript. It's designed to work either/both in the browser or on the server, with the same code-base and the same template files.

HandlebarJS takes as its only input data in a simple JSON data-dictionary format, and returns output from the template(s) selected.

Templates are selected by specifying a "state" (an abitrary string value representing the state of the application at that moment) rather than a URL.

HandlebarJS will "compile" requested templates into executable JavaScript functions, which take the JSON data dictionary as input and return the output. The compilation of templates can either be JIT (at request time) or driven by build processes, as desired.

-------

Examples:

The examples/ directory has three sample template files, a "manifest" called "templates.json" (which is the JSON dictionary that maps "states" to templates for the engine), "index.html" file showing how to intialize the template engine, and a "app.js" file showing how to use the engine to request remote data and parse templates for dynamic output.

NOTE: the "index.html" makes use of LABjs (http://labjs.com) to load scripts. It is not included in this source tree, nor is it required for HandlebarJS. LABjs can also be found on github: http://github.com/getify/LABjs

-------

Templating sytax:



-Define a named template section-

{$: "#xxx" }

	...

{$}


-Define a named template section with data initialization-

{$: "#xxx" | x=data.val1 | y=data.val2?"#yyy":"#zzz" }

	...

{$}



-Replace tag with data variable-

{$= data.value $}



-Include template section-

{$= @"#yyy" $}



-Include template section from data variable-

{$= @value $}



-Loop on data variable (array or plain key/value object)-

{$* data.value }

	...

{$}



-Loop on data variable with loop iteration initialization-
   --`item` iteration binding has: 
      `key` (index), `value`, `first`, `last`, `odd`, and `even`

{$* data.value | rowtype=item.odd?"#oddrow":"#evenrow" | someprop=item.value.someProp?"#hassomeprop" }

	...
	{$= @rowtype $}
	...
	{$= @someprop $}
	...
	{$= item.value.otherProp $}
	...

{$}




-"Extend" (inherit from) another template file-

{$+ "template/file.url" $}



-Raw un-parsed section-

{$%

	...

%$}



-Template comment block-

{$/

	...

/$}