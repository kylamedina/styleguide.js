var fs = require('fs');
var cons = require('consolidate');
var path = require('path');
var mkdirp = require('mkdirp');
var marked = require('marked');
var pug = require('pug');
var _ = require('lodash');
var cssYaml = require('./cssyaml.js');
var htmlIncludes = require('./htmlincludes.js');
var beautifyHtml = require('js-beautify').html;
var hljs = require('highlight.js');


function readFileSync(file) {
    return fs.readFileSync(file, {encoding:'utf8'})
}

function StyleGuide() {
    this.options = {};
    this.sources = [];
}

StyleGuide.defaults = {
    groupBy: 'section',
    sortBy: ['section', 'title'],

    engine: 'pug',
    
    extraJs: [],
    extraCss: [],

    outputFile: null,

    template: __dirname + '/template/index.pug',
    templateCss: __dirname + '/template/styleguide.styl',
    templateJs: __dirname + '/template/styleguide.js'
};

StyleGuide.prototype = {
    addFile: function(file) {
        this.addSource(readFileSync(file));
    },

    addSource: function(source) {
        this.sources.push(source);
    },

    groupSort: function(docs) {
        docs = _.sortBy(docs, this.options.sortBy);
        return _.groupBy(docs, this.options.groupBy);
    },

    parseSource: function() {
        return cssYaml.parse(this.sources.join(" "));
    },

    parseHtmlIncludes: function(docBlocks) {
        return htmlIncludes.parse(docBlocks, {
            html: 'html'
        });
    },
    convertpug: function(sources) {
        locals = {}
        pugOptions = {
            pretty: true
        };
        if(sources){
            return sources.map(function(source) {
                if(Array.isArray(source.example)){
                    source.example = source.example.join('');
                }
                // Compile a function
                var fn = pug.compile(source.example,pugOptions);
                // Render the function
                source.html = fn(locals);
                return source;
            });
        }
    },
    beautifyHtml: function(sources) {
        var options = {
            "indent_size": 4,
            "wrap_line_length": 60,
            "unformatted": [],
            "preserve_newlines": false
        };
        if(sources){
            return sources.map(function(source) {
                if(Array.isArray(source)){
                    source.html = source.html.join('');
                    source.example = source.example.join('');
                }
                source.html = beautifyHtml(source.html, options);
                source.example = hljs.highlightAuto(source.example, ['pug']).value;
                return source;
            });
        }
    },

    render: function(options, callback) {
        options = this.options = _.defaults(options || {}, StyleGuide.defaults);

        // fetch the extra js files
        var extraJs = [];
        options.extraJs.forEach(function(file) {
            extraJs.push(readFileSync(file));
        });

        // append the extra stylesheets to the source
        options.extraCss.forEach(function(file) {
            this.addFile(file);
        }, this);

        var source = this.parseSource();
        source = this.convertpug(source);
        source = this.parseHtmlIncludes(source);

        // beautify the html
        source = this.beautifyHtml(source);

        // data to send to the template
        var data = {
            marked: marked,
            options: options,

            docs: this.groupSort(source),
            css: this.sources.join(" "),
            js: extraJs.join("; "),

            templateCss: readFileSync(options.templateCss),
            templateJs: readFileSync(options.templateJs)
        };

        // template
        cons[options.engine](options.template, data, function(err, html) {
            if(callback) {
                callback(err, html);
            }
            if(err) {
                throw err;
            }
            if(options.outputFile) {
                mkdirp.sync(path.dirname(options.outputFile));
                fs.writeFileSync(options.outputFile, html, {encoding:'utf8'});
            }
        });
    }
};

module.exports = StyleGuide;
