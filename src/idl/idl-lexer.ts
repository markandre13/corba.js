/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2020 Mark-André Hopf <mhopf@mark13.org>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Type, Node } from "./idl-node"

export class Lexer {
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

    static isDigit(c: string): boolean {
        let n = c.charCodeAt(0)
        return (0x30 <= n && n <= 0x39)
    }
    
    static isAlphaNumeric(c: string): boolean {
        return Lexer.isAlpha(c) || Lexer.isDigit(c)
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
        if (token.child.length !== 0)
            throw Error("can not unlex token "+token.toString()+" with children")
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
                        case ':':
                            this.state = 7
                            break
                        // case '0':
                        //     this.state = ...
                        //     break
                        // case '1':
                        // case '2':
                        // case '3':
                        // case '4':
                        // case '5':
                        // case '6':
                        // case '7':
                        // case '8':
                        // case '9':
                        //     this.state = ...
                        //     break
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
                    if (!Lexer.isAlphaNumeric(c) && c!=="_") {
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
                    break
                case 7: // :
                    this.state = 0
                    if (c == ':') {
                        return new Node(Type.TKN_COLON_COLON, "::")
                    } else {
                        this.ungetc()
                        return new Node(Type.TKN_TEXT, ':')
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
