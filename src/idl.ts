/*
 *  glue.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018 Mark-André Hopf <mhopf@mark13.org>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// This IDL mimics the CORBA 3.0 IDL grammar.
//
// The CORBA IDL was derived from the Spring IDL, which was an object
// oriented operating system research project at Sun Microsystems.
//
// CORBA was quite a hype in its days and was used by OpenDoc (IBM, Apple),
// Fresco (an X11 successor), KDE, ... but in the end it failed. Bloated,
// huge, designed by comitee, ...
//
// While this IDL parser is based on the CORBA 3.0 specification, it
// implements only what is needed for my Workflow app (plus some things
// which didn't require thinking like the full list of keywords and no
// changes to the grammar).

import * as fs from "fs"

enum TokenType {
    NONE,
    IDENTIFIER,
    TEXT,
    
    ABSTRACT,
    ANY,
    ATTRIBUTE,
    BOOLEAN,
    CASE,
    CHAR,
    COMPONENT,
    CONST,
    CONSUMES,
    CONTEXT,
    CUSTOM,
    DEFAULT,
    DOUBLE,
    EXCEPTION,
    EMITS,
    ENUM,
    EVENTTYPE,
    FACTORY,
    FALSE,
    FINDER,
    FIXED,
    FLOAT,
    GETRAISES,
    HOME,
    IMPORT,
    IN,
    INOUT,
    INTERFACE,
    LOCAL,
    LONG,
    MODULE,
    MULTIPLE,
    NATIVE,
    OBJECT,
    OCTET,
    ONEWAY,
    OUT,
    PRIMARYKEY,
    PRIVATE,
    PROVIDES,
    PUBLIC,
    PUBLISHES,
    RAISES,
    READONLY,
    SETRAISES,
    SEQUENCE,
    SHORT,
    STRING,
    STRUCT,
    SUPPORTS,
    SWITCH,
    TRUE,
    TRUNCATABLE,
    TYPEDEF,
    TYPEID,
    TYPEPREFIX,
    UNSIGNED,
    UNION,
    USES,
    VALUEBASE,
    VALUETYPE,
    VOID,
    WCHAR,
    WSTRING
}

class Token
{
    type: TokenType
    text?: string
    
    constructor(type: TokenType, text?: string) {
        this.type = type
        this.text = text
    }
    
    toString(): string {
        switch(this.type) {
            case TokenType.NONE:        return "none"
            case TokenType.TEXT:        return "text '"+this.text+"'"
            case TokenType.IDENTIFIER:  return "identifier '"+this.text+"'"

            case TokenType.ABSTRACT:    return "abstract"
            case TokenType.ANY:         return "any"
            case TokenType.ATTRIBUTE:   return "attribute"
            case TokenType.BOOLEAN:     return "boolean"
            case TokenType.CASE:        return "case"
            case TokenType.CHAR:        return "char"
            case TokenType.COMPONENT:   return "component"
            case TokenType.CONST:       return "const"
            case TokenType.CONSUMES:    return "consumes"
            case TokenType.CONTEXT:     return "context"
            case TokenType.CUSTOM:      return "custom"
            case TokenType.DEFAULT:     return "default"
            case TokenType.DOUBLE:      return "double"
            case TokenType.EXCEPTION:   return "exception"
            case TokenType.EMITS:       return "emits"
            case TokenType.ENUM:        return "enum"
            case TokenType.EVENTTYPE:   return "eventtype"
            case TokenType.FACTORY:     return "factory"
            case TokenType.FALSE:       return "FALSE"
            case TokenType.FINDER:      return "finder"
            case TokenType.FIXED:       return "fixed"
            case TokenType.FLOAT:       return "float"
            case TokenType.GETRAISES:   return "getraises"
            case TokenType.HOME:        return "home"
            case TokenType.IMPORT:      return "import"
            case TokenType.IN:          return "in"
            case TokenType.INOUT:       return "inout"
            case TokenType.INTERFACE:   return "interface"
            case TokenType.LOCAL:       return "local"
            case TokenType.LONG:        return "long"
            case TokenType.MODULE:      return "module"
            case TokenType.MULTIPLE:    return "multiple"
            case TokenType.NATIVE:      return "native"
            case TokenType.OBJECT:      return "Object"
            case TokenType.OCTET:       return "octet"
            case TokenType.ONEWAY:      return "oneway"
            case TokenType.OUT:         return "out"
            case TokenType.PRIMARYKEY:  return "primarykey"
            case TokenType.PRIVATE:     return "private"
            case TokenType.PROVIDES:    return "provides"
            case TokenType.PUBLIC:      return "public"
            case TokenType.PUBLISHES:   return "publishes"
            case TokenType.RAISES:      return "raises"
            case TokenType.READONLY:    return "readonly"
            case TokenType.SETRAISES:   return "setraises"
            case TokenType.SEQUENCE:    return "sequence"
            case TokenType.SHORT:       return "short"
            case TokenType.STRING:      return "string"
            case TokenType.STRUCT:      return "struct"
            case TokenType.SUPPORTS:    return "supports"
            case TokenType.SWITCH:      return "switch"
            case TokenType.TRUE:        return "TRUE"
            case TokenType.TRUNCATABLE: return "truncatable"
            case TokenType.TYPEDEF:     return "typedef"
            case TokenType.TYPEID:      return "typeid"
            case TokenType.TYPEPREFIX:  return "typeprefix"
            case TokenType.UNSIGNED:    return "unsigned"
            case TokenType.UNION:       return "union"
            case TokenType.USES:        return "uses"
            case TokenType.VALUEBASE:   return "ValueBase"
            case TokenType.VALUETYPE:   return "valuetype"
            case TokenType.VOID:        return "void"
            case TokenType.WCHAR:       return "wchar"
            case TokenType.WSTRING:     return "wstring"
        }
        throw Error("unknown type")
    }
}

class Lexer {
    data: string
    line: number
    column: number
    
    pos: number
    state: number
    text?: string
    tokenStack: Array<Token>

    static isAlpha(c: string): boolean {
        let n = c.charCodeAt(0)
        return (
                 (0x41 <= n && n <= 0x5a) ||
                 (0x61 <= n && n <= 0x7a)
               )
    }

    constructor(data: string) {
        this.data = data
        this.line = 1
        this.column = 1
        this.pos = 0
        this.state = 0
        this.tokenStack = new Array<Token>()
    }
    
    eof(): boolean {
        return this.pos >= this.data.length
    }

    getc(): string {
        let c = this.data[this.pos++]
        if (c=='\n') {
            ++this.line
            this.column = 1
        } else {
            ++this.column // FIXME: tabulators
        }
        return c
    }
    
    ungetc(): void {
        let c = this.data[--this.pos]
        if (c=='\n') {
            let i
            for(i=this.pos; i>0; --i) {
                if (this.data[i] == '\n')
                    break
            }
            this.column = i
            --this.line
        } else {
            --this.column
        }
    }
    
    unlex(token: Token | undefined): void {
        if (token === undefined)
            return
        // FIXME: adjust this.line and this.column
        this.tokenStack.push(token)
    }
    
    lex(): Token | undefined {
        if (this.tokenStack.length > 0) {
            return this.tokenStack.pop()
        }
        while(!this.eof()) {
            let c = this.getc()
//console.log("state="+this.state+" c='"+c+"'")
            let oldstate = this.state
            switch(this.state) {
                case 0:
                    switch(c) {
                        case ' ':
                        case '\r':
                        case '\n':
                        case '\t':
                        case '\v':
                            break
                        case '/':
                            this.state = 3
                            break
                        case '_':
                            this.state = 1
                            this.text = ""
                            continue
                        default:
                            if (Lexer.isAlpha(c)) {
                                this.state = 2
                            } else {
                                return new Token(TokenType.TEXT, c)
                            }
                            break
                    }
                    break
                case 1: // _<identifier> CORBA IDL style identifier escape
                    if (!Lexer.isAlpha(c)) {
                        this.ungetc()
                        this.state = 0
                        return new Token(TokenType.IDENTIFIER, this.text)
                    }
                    break
                case 2: // <identifier>
                    if (!Lexer.isAlpha(c)) { // FIXME: also numeric and _
                        this.ungetc()
                        this.state = 0
                        switch(this.text) {
                            case "abstract":    return new Token(TokenType.ABSTRACT)
                            case "any":         return new Token(TokenType.ANY)
                            case "attribute":   return new Token(TokenType.ATTRIBUTE)
                            case "boolean":     return new Token(TokenType.BOOLEAN)
                            case "case":        return new Token(TokenType.CASE)
                            case "char":        return new Token(TokenType.CHAR)
                            case "component":   return new Token(TokenType.COMPONENT)
                            case "const":       return new Token(TokenType.CONST)
                            case "consumes":    return new Token(TokenType.CONSUMES)
                            case "context":     return new Token(TokenType.CONTEXT)
                            case "custom":      return new Token(TokenType.CUSTOM)
                            case "default":     return new Token(TokenType.DEFAULT)
                            case "double":      return new Token(TokenType.DOUBLE)
                            case "exception":   return new Token(TokenType.EXCEPTION)
                            case "emits":       return new Token(TokenType.EMITS)
                            case "enum":        return new Token(TokenType.ENUM)
                            case "eventtype":   return new Token(TokenType.EVENTTYPE)
                            case "factory":     return new Token(TokenType.FACTORY)
                            case "FALSE":       return new Token(TokenType.FALSE)
                            case "finder":      return new Token(TokenType.FINDER)
                            case "fixed":       return new Token(TokenType.FIXED)
                            case "float":       return new Token(TokenType.FLOAT)
                            case "getraises":   return new Token(TokenType.GETRAISES)
                            case "home":        return new Token(TokenType.HOME)
                            case "import":      return new Token(TokenType.IMPORT)
                            case "in":          return new Token(TokenType.IN)
                            case "inout":       return new Token(TokenType.INOUT)
                            case "interface":   return new Token(TokenType.INTERFACE)
                            case "local":       return new Token(TokenType.LOCAL)
                            case "long":        return new Token(TokenType.LONG)
                            case "module":      return new Token(TokenType.MODULE)
                            case "multiple":    return new Token(TokenType.MULTIPLE)
                            case "native":      return new Token(TokenType.NATIVE)
                            case "Object":      return new Token(TokenType.OBJECT)
                            case "octet":       return new Token(TokenType.OCTET)
                            case "oneway":      return new Token(TokenType.ONEWAY)
                            case "out":         return new Token(TokenType.OUT)
                            case "primarykey":  return new Token(TokenType.PRIMARYKEY)
                            case "private":     return new Token(TokenType.PRIVATE)
                            case "provides":    return new Token(TokenType.PROVIDES)
                            case "public":      return new Token(TokenType.PUBLIC)
                            case "publishes":   return new Token(TokenType.PUBLISHES)
                            case "raises":      return new Token(TokenType.RAISES)
                            case "readonly":    return new Token(TokenType.READONLY)
                            case "setraises":   return new Token(TokenType.SETRAISES)
                            case "sequence":    return new Token(TokenType.SEQUENCE)
                            case "short":       return new Token(TokenType.SHORT)
                            case "string":      return new Token(TokenType.STRING)
                            case "struct":      return new Token(TokenType.STRUCT)
                            case "supports":    return new Token(TokenType.SUPPORTS)
                            case "switch":      return new Token(TokenType.SWITCH)
                            case "TRUE":        return new Token(TokenType.TRUE)
                            case "truncatable": return new Token(TokenType.TRUNCATABLE)
                            case "typedef":     return new Token(TokenType.TYPEDEF)
                            case "typeid":      return new Token(TokenType.TYPEID)
                            case "typeprefix":  return new Token(TokenType.TYPEPREFIX)
                            case "unsigned":    return new Token(TokenType.UNSIGNED)
                            case "union":       return new Token(TokenType.UNION)
                            case "uses":        return new Token(TokenType.USES)
                            case "ValueBase":   return new Token(TokenType.VALUEBASE)
                            case "valuetype":   return new Token(TokenType.VALUETYPE)
                            case "void":        return new Token(TokenType.VOID)
                            case "wchar":       return new Token(TokenType.WCHAR)
                            case "wstring":     return new Token(TokenType.WSTRING)
                            default:
                                return new Token(TokenType.IDENTIFIER, this.text)
                        }
                    }
                    break
                case 3: // /...
                    switch(c) {
                        case '/':
                            this.state = 4
                            break
                        case '*':
                            this.state = 5
                            break
                        default:
                            this.ungetc()
                            return new Token(TokenType.TEXT, '/')
                    }
                    break
                case 4: // //...
                    switch(c) {
                        case '\n':
                            this.state = 0
                            break
                    }
                    break
                case 5: // /*...
                    switch(c) {
                        case '*':
                            this.state = 6
                            break
                    }
                    break
                case 6: // /*...*
                    switch(c) {
                        case '/':
                            this.state = 0
                            break
                        case '*':
                            break
                        default:
                            this.state = 5
                    }
            }
            if (oldstate == 0) {
                this.text = c
            } else {
                this.text += c
            }
        }
        return undefined
    }
}

var file = fs.readFileSync("test.idl", "utf8")

let lexer = new Lexer(file)

/*
while(true) {
    let token = lexer.lex()
    if (token === undefined)
        break
    console.log(token.toString())
}
*/

try {
    specification()
    console.log("done")
}
catch(error) {
    console.log(error.message+" at line "+lexer.line+", column "+lexer.column)
    console.log(error.stack)
}

// 1
function specification()
{
    definition()
}

// 2
function definition()
{
    _interface()
}

// 4
function _interface()
{
    interface_dcl()
}

// 5
function interface_dcl()
{
    let n0 = interface_header()
    if (!n0)
        return
    let t0 = lexer.lex()
    if (!t0)
        throw Error("unexpected end of file")
    if (t0.type !== TokenType.TEXT && t0.text != '{')
        throw Error("expected { after interface header but got "+t0.toString())
    interface_body()
    let t2 = lexer.lex()
    if (!t2)
        throw Error("unexpected end of file")
    if (t2.type !== TokenType.TEXT && t2.text != '}')
        throw Error("expected } after interface header but got "+t2.toString())
}

// 7
function interface_header(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.INTERFACE) {
        let t1 = identifier()
        if (t1 !== undefined)
            return t1
        throw Error("expected identifier after 'interface'")
    }
    lexer.unlex(t0)
    return t0
}

// 8
function interface_body(): Token | undefined
{
    while(true) {
        let t0 = _export()
        if (t0 === undefined)
            return t0
        console.log("interface_body got one export at line "+lexer.line)
    }
}

// 9
function _export(): Token | undefined
{
    let t0
    t0 = op_decl()
    if (t0===undefined)
        return undefined

    let t1 = lexer.lex()    
    if (t1 !== undefined && t1.type === TokenType.TEXT && t1.text === ';')
        return t1
    if (t1 !== undefined)
        throw Error("expected ';' but got "+t1.toString())
    else
        throw Error("expected ';' but got end of file")
}

// 46
function base_type_spec(): Token | undefined
{
    let t0
    t0 = floating_pt_type()
    if (t0 !== undefined)
        return t0
    t0 = integer_type()
    if (t0 !== undefined)
        return t0
    t0 = char_type()
    if (t0 !== undefined)
        return t0
    t0 = wide_char_type()
    if (t0 !== undefined)
        return t0
    t0 = boolean_type()
    if (t0 !== undefined)
        return t0
    t0 = octet_type()
    if (t0 !== undefined)
        return t0
    t0 = any_type()
    if (t0 !== undefined)
        return t0
    return undefined
}

// 51
function simple_declarator(): Token | undefined
{
    return identifier()
}

// 53
function floating_pt_type(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === TokenType.FLOAT)
        return t0
    if (t0.type === TokenType.DOUBLE)
        return t0
    if (t0.type === TokenType.LONG) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === TokenType.DOUBLE) {
//            return t0.add(t1) FIXME
            return t1
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 54
function integer_type(): Token | undefined
{
    let t0
    t0 = signed_int()
    if (t0)
        return t0
    t0 = unsigned_int()
    if (t0)
        return t0
    return undefined
}

// 55
function signed_int(): Token | undefined
{
    let t0
    t0 = signed_short_int()
    if (t0 !== undefined)
        return t0
    t0 = signed_longlong_int()
    if (t0 !== undefined)
        return t0
    t0 = signed_long_int()
    if (t0 !== undefined)
        return t0
    return undefined
}

// 56
function signed_short_int(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.SHORT)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 57
function signed_long_int(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === TokenType.LONG)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 58
function signed_longlong_int(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.LONG) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === TokenType.LONG) {
            // FIXME
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 59
function unsigned_int(): Token | undefined
{
    let t0
    t0 = unsigned_short_int()
    if (t0 !== undefined)
        return t0
    t0 = unsigned_longlong_int()
    if (t0 !== undefined)
        return t0
    t0 = unsigned_long_int()
    if (t0 !== undefined)
        return t0
    return undefined
}

// 60
function unsigned_short_int(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === TokenType.SHORT) {
            // FIXME
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 61
function unsigned_long_int(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === TokenType.LONG) {
            // FIXME
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 62
function unsigned_longlong_int(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === TokenType.LONG) {
            let t2 = lexer.lex()
            if (t2 !== undefined && t2.type === TokenType.LONG)
                return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 63
function char_type(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == TokenType.CHAR)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 64
function wide_char_type(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == TokenType.WCHAR)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 65
function boolean_type(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == TokenType.BOOLEAN)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 66
function octet_type(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == TokenType.OCTET)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 67
function any_type(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == TokenType.ANY)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 81
function string_type()
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.STRING) {
        // 'string' '<' <positive_int_const> '>'
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 87
function op_decl()
{
    let t0 = op_attribute() // opt
    let t1 = op_type_spec()
    if (t1 === undefined) {
        lexer.unlex(t0)
        return undefined
    }
    let t2 = identifier()
    let t3 = parameter_dcls()
    
if (t0) console.log("t0: "+t0.toString())
if (t1) console.log("t1: "+t1.toString())
if (t2) console.log("t2: "+t2.toString())
if (t3) console.log("t3: "+t3.toString())

    return t1
}

// 88
function op_attribute(): Token | undefined
{
    let t0 = lexer.lex()
    if (!t0)
        return undefined
    if (t0.type !== TokenType.ONEWAY) {
        lexer.unlex(t0)
        return undefined
    }
    return t0
}

// 89
function op_type_spec(): Token | undefined
{
    let t0 = param_type_spec()
    if (t0 !== undefined)
        return t0
    t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.VOID)
         return t0
    lexer.unlex(t0)
    return undefined
}

// 90
function parameter_dcls(): Token | undefined
{
    let t0 = lexer.lex()
    if (!t0) {
        return undefined
    }
    if (t0.type !== TokenType.TEXT || t0.text !== '(')
    {
        lexer.unlex(t0)
        return undefined
    }
 
    while(true) {
        let t1 = param_dcl()
    
        let t2 = lexer.lex()
    
        if (t2 !== undefined && t2.type === TokenType.TEXT && t2.text === ')') {
            return t0 // FIXME: t1 maybe undefined because the list exists but is empty
        }
        if (t2 !== undefined && t2.type === TokenType.TEXT && t2.text === ",") {
            continue
        }
        throw Error("expected ')' at end for parameter declaration")
    }
}

// 91
function param_dcl(): Token | undefined
{
    param_attribute()
    param_type_spec()
    simple_declarator()
    return undefined
}

// 92
function param_attribute(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    switch(t0.type) {
        case TokenType.IN:
        case TokenType.OUT:
        case TokenType.INOUT:
            return t0
    }
    throw Error("expected either 'in', 'out' or 'inout'")
}

// 95
function param_type_spec(): Token | undefined
{
    let t0
    t0 = base_type_spec()
    if (t0 !== undefined) {
        return t0
    }
    t0 = string_type()
    if (t0 !== undefined) {
        return t0
    }
/*
    if (t0)
        return t0
    t0 = wide_string_type()
    if (t0)
        return t0
    t0 = scoped_name()
*/
    return t0
}

function identifier(): Token | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === TokenType.IDENTIFIER)
        return t0
    lexer.unlex(t0)
    return undefined
}