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

enum Type {
    NONE,

    TKN_IDENTIFIER,
    TKN_TEXT,
    
    // CORBA IDL KEYWORDS
    TKN_ABSTRACT,
    TKN_ANY,
    TKN_ATTRIBUTE,
    TKN_BOOLEAN,
    TKN_CASE,
    TKN_CHAR,
    TKN_COMPONENT,
    TKN_CONST,
    TKN_CONSUMES,
    TKN_CONTEXT,
    TKN_CUSTOM,
    TKN_DEFAULT,
    TKN_DOUBLE,
    TKN_EXCEPTION,
    TKN_EMITS,
    TKN_ENUM,
    TKN_EVENTTYPE,
    TKN_FACTORY,
    TKN_FALSE,
    TKN_FINDER,
    TKN_FIXED,
    TKN_FLOAT,
    TKN_GETRAISES,
    TKN_HOME,
    TKN_IMPORT,
    TKN_IN,
    TKN_INOUT,
    TKN_INTERFACE,
    TKN_LOCAL,
    TKN_LONG,
    TKN_MODULE,
    TKN_MULTIPLE,
    TKN_NATIVE,
    TKN_OBJECT,
    TKN_OCTET,
    TKN_ONEWAY,
    TKN_OUT,
    TKN_PRIMARYKEY,
    TKN_PRIVATE,
    TKN_PROVIDES,
    TKN_PUBLIC,
    TKN_PUBLISHES,
    TKN_RAISES,
    TKN_READONLY,
    TKN_SETRAISES,
    TKN_SEQUENCE,
    TKN_SHORT,
    TKN_STRING,
    TKN_STRUCT,
    TKN_SUPPORTS,
    TKN_SWITCH,
    TKN_TRUE,
    TKN_TRUNCATABLE,
    TKN_TYPEDEF,
    TKN_TYPEID,
    TKN_TYPEPREFIX,
    TKN_UNSIGNED,
    TKN_UNION,
    TKN_USES,
    TKN_VALUEBASE,
    TKN_VALUETYPE,
    TKN_VOID,
    TKN_WCHAR,
    TKN_WSTRING
}

class Node
{
    type: Type
    text?: string
    
    constructor(type: Type, text?: string) {
        this.type = type
        this.text = text
    }
    
    toString(): string {
        switch(this.type) {
            case Type.NONE:            return "none"
            
            case Type.TKN_TEXT:        return "text '"+this.text+"'"
            case Type.TKN_IDENTIFIER:  return "identifier '"+this.text+"'"

            case Type.TKN_ABSTRACT:    return "abstract"
            case Type.TKN_ANY:         return "any"
            case Type.TKN_ATTRIBUTE:   return "attribute"
            case Type.TKN_BOOLEAN:     return "boolean"
            case Type.TKN_CASE:        return "case"
            case Type.TKN_CHAR:        return "char"
            case Type.TKN_COMPONENT:   return "component"
            case Type.TKN_CONST:       return "const"
            case Type.TKN_CONSUMES:    return "consumes"
            case Type.TKN_CONTEXT:     return "context"
            case Type.TKN_CUSTOM:      return "custom"
            case Type.TKN_DEFAULT:     return "default"
            case Type.TKN_DOUBLE:      return "double"
            case Type.TKN_EXCEPTION:   return "exception"
            case Type.TKN_EMITS:       return "emits"
            case Type.TKN_ENUM:        return "enum"
            case Type.TKN_EVENTTYPE:   return "eventtype"
            case Type.TKN_FACTORY:     return "factory"
            case Type.TKN_FALSE:       return "FALSE"
            case Type.TKN_FINDER:      return "finder"
            case Type.TKN_FIXED:       return "fixed"
            case Type.TKN_FLOAT:       return "float"
            case Type.TKN_GETRAISES:   return "getraises"
            case Type.TKN_HOME:        return "home"
            case Type.TKN_IMPORT:      return "import"
            case Type.TKN_IN:          return "in"
            case Type.TKN_INOUT:       return "inout"
            case Type.TKN_INTERFACE:   return "interface"
            case Type.TKN_LOCAL:       return "local"
            case Type.TKN_LONG:        return "long"
            case Type.TKN_MODULE:      return "module"
            case Type.TKN_MULTIPLE:    return "multiple"
            case Type.TKN_NATIVE:      return "native"
            case Type.TKN_OBJECT:      return "Object"
            case Type.TKN_OCTET:       return "octet"
            case Type.TKN_ONEWAY:      return "oneway"
            case Type.TKN_OUT:         return "out"
            case Type.TKN_PRIMARYKEY:  return "primarykey"
            case Type.TKN_PRIVATE:     return "private"
            case Type.TKN_PROVIDES:    return "provides"
            case Type.TKN_PUBLIC:      return "public"
            case Type.TKN_PUBLISHES:   return "publishes"
            case Type.TKN_RAISES:      return "raises"
            case Type.TKN_READONLY:    return "readonly"
            case Type.TKN_SETRAISES:   return "setraises"
            case Type.TKN_SEQUENCE:    return "sequence"
            case Type.TKN_SHORT:       return "short"
            case Type.TKN_STRING:      return "string"
            case Type.TKN_STRUCT:      return "struct"
            case Type.TKN_SUPPORTS:    return "supports"
            case Type.TKN_SWITCH:      return "switch"
            case Type.TKN_TRUE:        return "TRUE"
            case Type.TKN_TRUNCATABLE: return "truncatable"
            case Type.TKN_TYPEDEF:     return "typedef"
            case Type.TKN_TYPEID:      return "typeid"
            case Type.TKN_TYPEPREFIX:  return "typeprefix"
            case Type.TKN_UNSIGNED:    return "unsigned"
            case Type.TKN_UNION:       return "union"
            case Type.TKN_USES:        return "uses"
            case Type.TKN_VALUEBASE:   return "ValueBase"
            case Type.TKN_VALUETYPE:   return "valuetype"
            case Type.TKN_VOID:        return "void"
            case Type.TKN_WCHAR:       return "wchar"
            case Type.TKN_WSTRING:     return "wstring"
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
    tokenStack: Array<Node>

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
        this.tokenStack = new Array<Node>()
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
    
    unlex(token: Node | undefined): void {
        if (token === undefined)
            return
        // FIXME: adjust this.line and this.column
        this.tokenStack.push(token)
    }
    
    lex(): Node | undefined {
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
                                return new Node(Type.TKN_TEXT, c)
                            }
                            break
                    }
                    break
                case 1: // _<identifier> CORBA IDL style identifier escape
                    if (!Lexer.isAlpha(c)) {
                        this.ungetc()
                        this.state = 0
                        return new Node(Type.TKN_IDENTIFIER, this.text)
                    }
                    break
                case 2: // <identifier>
                    if (!Lexer.isAlpha(c)) { // FIXME: also numeric and _
                        this.ungetc()
                        this.state = 0
                        switch(this.text) {
                            case "abstract":    return new Node(Type.TKN_ABSTRACT)
                            case "any":         return new Node(Type.TKN_ANY)
                            case "attribute":   return new Node(Type.TKN_ATTRIBUTE)
                            case "boolean":     return new Node(Type.TKN_BOOLEAN)
                            case "case":        return new Node(Type.TKN_CASE)
                            case "char":        return new Node(Type.TKN_CHAR)
                            case "component":   return new Node(Type.TKN_COMPONENT)
                            case "const":       return new Node(Type.TKN_CONST)
                            case "consumes":    return new Node(Type.TKN_CONSUMES)
                            case "context":     return new Node(Type.TKN_CONTEXT)
                            case "custom":      return new Node(Type.TKN_CUSTOM)
                            case "default":     return new Node(Type.TKN_DEFAULT)
                            case "double":      return new Node(Type.TKN_DOUBLE)
                            case "exception":   return new Node(Type.TKN_EXCEPTION)
                            case "emits":       return new Node(Type.TKN_EMITS)
                            case "enum":        return new Node(Type.TKN_ENUM)
                            case "eventtype":   return new Node(Type.TKN_EVENTTYPE)
                            case "factory":     return new Node(Type.TKN_FACTORY)
                            case "FALSE":       return new Node(Type.TKN_FALSE)
                            case "finder":      return new Node(Type.TKN_FINDER)
                            case "fixed":       return new Node(Type.TKN_FIXED)
                            case "float":       return new Node(Type.TKN_FLOAT)
                            case "getraises":   return new Node(Type.TKN_GETRAISES)
                            case "home":        return new Node(Type.TKN_HOME)
                            case "import":      return new Node(Type.TKN_IMPORT)
                            case "in":          return new Node(Type.TKN_IN)
                            case "inout":       return new Node(Type.TKN_INOUT)
                            case "interface":   return new Node(Type.TKN_INTERFACE)
                            case "local":       return new Node(Type.TKN_LOCAL)
                            case "long":        return new Node(Type.TKN_LONG)
                            case "module":      return new Node(Type.TKN_MODULE)
                            case "multiple":    return new Node(Type.TKN_MULTIPLE)
                            case "native":      return new Node(Type.TKN_NATIVE)
                            case "Object":      return new Node(Type.TKN_OBJECT)
                            case "octet":       return new Node(Type.TKN_OCTET)
                            case "oneway":      return new Node(Type.TKN_ONEWAY)
                            case "out":         return new Node(Type.TKN_OUT)
                            case "primarykey":  return new Node(Type.TKN_PRIMARYKEY)
                            case "private":     return new Node(Type.TKN_PRIVATE)
                            case "provides":    return new Node(Type.TKN_PROVIDES)
                            case "public":      return new Node(Type.TKN_PUBLIC)
                            case "publishes":   return new Node(Type.TKN_PUBLISHES)
                            case "raises":      return new Node(Type.TKN_RAISES)
                            case "readonly":    return new Node(Type.TKN_READONLY)
                            case "setraises":   return new Node(Type.TKN_SETRAISES)
                            case "sequence":    return new Node(Type.TKN_SEQUENCE)
                            case "short":       return new Node(Type.TKN_SHORT)
                            case "string":      return new Node(Type.TKN_STRING)
                            case "struct":      return new Node(Type.TKN_STRUCT)
                            case "supports":    return new Node(Type.TKN_SUPPORTS)
                            case "switch":      return new Node(Type.TKN_SWITCH)
                            case "TRUE":        return new Node(Type.TKN_TRUE)
                            case "truncatable": return new Node(Type.TKN_TRUNCATABLE)
                            case "typedef":     return new Node(Type.TKN_TYPEDEF)
                            case "typeid":      return new Node(Type.TKN_TYPEID)
                            case "typeprefix":  return new Node(Type.TKN_TYPEPREFIX)
                            case "unsigned":    return new Node(Type.TKN_UNSIGNED)
                            case "union":       return new Node(Type.TKN_UNION)
                            case "uses":        return new Node(Type.TKN_USES)
                            case "ValueBase":   return new Node(Type.TKN_VALUEBASE)
                            case "valuetype":   return new Node(Type.TKN_VALUETYPE)
                            case "void":        return new Node(Type.TKN_VOID)
                            case "wchar":       return new Node(Type.TKN_WCHAR)
                            case "wstring":     return new Node(Type.TKN_WSTRING)
                            default:
                                return new Node(Type.TKN_IDENTIFIER, this.text)
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
                            return new Node(Type.TKN_TEXT, '/')
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
    if (t0.type !== Type.TKN_TEXT && t0.text != '{')
        throw Error("expected { after interface header but got "+t0.toString())
    interface_body()
    let t2 = lexer.lex()
    if (!t2)
        throw Error("unexpected end of file")
    if (t2.type !== Type.TKN_TEXT && t2.text != '}')
        throw Error("expected } after interface header but got "+t2.toString())
}

// 7
function interface_header(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_INTERFACE) {
        let t1 = identifier()
        if (t1 !== undefined)
            return t1
        throw Error("expected identifier after 'interface'")
    }
    lexer.unlex(t0)
    return t0
}

// 8
function interface_body(): Node | undefined
{
    while(true) {
        let t0 = _export()
        if (t0 === undefined)
            return t0
        console.log("interface_body got one export at line "+lexer.line)
    }
}

// 9
function _export(): Node | undefined
{
    let t0
    t0 = op_decl()
    if (t0===undefined)
        return undefined

    let t1 = lexer.lex()    
    if (t1 !== undefined && t1.type === Type.TKN_TEXT && t1.text === ';')
        return t1
    if (t1 !== undefined)
        throw Error("expected ';' but got "+t1.toString())
    else
        throw Error("expected ';' but got end of file")
}

// 46
function base_type_spec(): Node | undefined
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
function simple_declarator(): Node | undefined
{
    return identifier()
}

// 53
function floating_pt_type(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === Type.TKN_FLOAT)
        return t0
    if (t0.type === Type.TKN_DOUBLE)
        return t0
    if (t0.type === Type.TKN_LONG) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_DOUBLE) {
//            return t0.add(t1) FIXME
            return t1
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 54
function integer_type(): Node | undefined
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
function signed_int(): Node | undefined
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
function signed_short_int(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_SHORT)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 57
function signed_long_int(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === Type.TKN_LONG)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 58
function signed_longlong_int(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_LONG) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            // FIXME
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 59
function unsigned_int(): Node | undefined
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
function unsigned_short_int(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_SHORT) {
            // FIXME
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 61
function unsigned_long_int(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            // FIXME
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 62
function unsigned_longlong_int(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            let t2 = lexer.lex()
            if (t2 !== undefined && t2.type === Type.TKN_LONG)
                return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 63
function char_type(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_CHAR)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 64
function wide_char_type(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_WCHAR)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 65
function boolean_type(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_BOOLEAN)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 66
function octet_type(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_OCTET)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 67
function any_type(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_ANY)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 81
function string_type()
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_STRING) {
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
function op_attribute(): Node | undefined
{
    let t0 = lexer.lex()
    if (!t0)
        return undefined
    if (t0.type !== Type.TKN_ONEWAY) {
        lexer.unlex(t0)
        return undefined
    }
    return t0
}

// 89
function op_type_spec(): Node | undefined
{
    let t0 = param_type_spec()
    if (t0 !== undefined)
        return t0
    t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_VOID)
         return t0
    lexer.unlex(t0)
    return undefined
}

// 90
function parameter_dcls(): Node | undefined
{
    let t0 = lexer.lex()
    if (!t0) {
        return undefined
    }
    if (t0.type !== Type.TKN_TEXT || t0.text !== '(')
    {
        lexer.unlex(t0)
        return undefined
    }
 
    while(true) {
        let t1 = param_dcl()
    
        let t2 = lexer.lex()
    
        if (t2 !== undefined && t2.type === Type.TKN_TEXT && t2.text === ')') {
            return t0 // FIXME: t1 maybe undefined because the list exists but is empty
        }
        if (t2 !== undefined && t2.type === Type.TKN_TEXT && t2.text === ",") {
            continue
        }
        throw Error("expected ')' at end for parameter declaration")
    }
}

// 91
function param_dcl(): Node | undefined
{
    param_attribute()
    param_type_spec()
    simple_declarator()
    return undefined
}

// 92
function param_attribute(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    switch(t0.type) {
        case Type.TKN_IN:
        case Type.TKN_OUT:
        case Type.TKN_INOUT:
            return t0
    }
    throw Error("expected either 'in', 'out' or 'inout'")
}

// 95
function param_type_spec(): Node | undefined
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

function identifier(): Node | undefined
{
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_IDENTIFIER)
        return t0
    lexer.unlex(t0)
    return undefined
}