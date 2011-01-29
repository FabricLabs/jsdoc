/**
    @module jsdoc/src/handlers
 */

(function() {
    var currentModule = null;
    
    /**
        Attach these event handlers to a particular instance of a parser.
     */
    exports.attachTo = function(parser) {
        var jsdoc = {doclet: require('jsdoc/doclet')};
        
        // handles JSDoc comments that include a @name tag -- the code is ignored in such a case
        parser.on('jsdocCommentFound', function(e) {
            var newDoclet = new jsdoc.doclet.Doclet(e.comment, e);
            if (!newDoclet.name) {
                return false; // only interested in virtual comments (with a @name) here
            }
            
            addDoclet.call(this, newDoclet);
            if (newDoclet.kind === 'module') {
                currentModule = newDoclet.longname;
            }
            e.doclet = newDoclet;
        });
        
        // handles named symbols in the code, may or may not have a JSDoc comment attached
        parser.on('symbolFound', function(e) {
            var newDoclet = new jsdoc.doclet.Doclet(e.comment, e);
            
            // an undocumented symbol right after a virtual comment? rhino mistakenly connected the two
            if (newDoclet.name) { // there was a @name in comment
                // try again, without the comment
                e.comment = '@undocumented';
                newDoclet = new jsdoc.doclet.Doclet(e.comment, e);
            } 
            
            if (newDoclet.alias) {
                newDoclet.addTag('name', newDoclet.alias);
                newDoclet.postProcess();
            }
            else if (e.code && e.code.name) { // we need to get the symbol name from code
                newDoclet.addTag('name', e.code.name);
                
                if (!newDoclet.memberof && e.astnode) {
                    var memberofName;
                    
                    if ( /^(exports|this)(\.|$)/.test(newDoclet.name) ) {
                        newDoclet.name = newDoclet.name.replace(/^(exports|this)(\.|$)/, '');
                        
                        if (RegExp.$1 === 'exports' && currentModule) {
                            memberofName = currentModule;
                        }
                        else {
                            memberofName = this.resolveThis(e.astnode);
                        }
                        
                        if (memberofName) {
                            if (newDoclet.name) {
                                newDoclet.name = memberofName + (RegExp.$1 === 'this'? '#' : '.') + newDoclet.name;
                            }
                            else { newDoclet.name = memberofName; }
                        }
                    }
                    else {
                        memberofName = this.astnodeToMemberof(e.astnode);
                    }
                    
                    if (memberofName) { newDoclet.addTag( 'memberof', memberofName); }
                }
                
                newDoclet.postProcess();
            }
            else {
                return false;
            }
            
            addDoclet.call(this, newDoclet);
            e.doclet = newDoclet;
        });
        
        //parser.on('fileBegin', function(e) { });
        
        parser.on('fileComplete', function(e) {
            currentModule = null;
        });
    
        function addDoclet(newDoclet) {
            if (newDoclet) {
                e = { doclet: newDoclet };
                this.fire('newDoclet', e);
                
                if (!e.defaultPrevented) {
                    this.addResult(newDoclet);
                }
            }
        }
    }
})();