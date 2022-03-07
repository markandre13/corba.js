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

export enum Type {
    NONE,

    TKN_IDENTIFIER,
    TKN_TEXT,
    TKN_COLON_COLON,
    
    // CORBA 3.0 IDL keywords
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
    TKN_WSTRING,
    
    // nodes for the syntax parse tree
    SYN_SPECIFICATION, // 1
    SYN_INTERFACE, // 5
    SYN_INTERFACE_HEADER, // 7
    SYN_INTERFACE_BODY, // 8
    SYN_VALUE_HEADER, // 18
    SYN_VALUE_INHERITANCE_SPEC, // 19
    SYN_STATE_MEMBER, // 22
    SYN_TYPE_DECLARATOR, // 43
    SYN_DECLARATORS, // 49
    SYN_MEMBER_LIST, // 70
    SYN_MEMBER, // 71
    SYN_SWITCH_BODY, // 74
    SYN_OPERATION_DECLARATION, // 87
    SYN_PARAMETER_DECLARATIONS, // 90
    SYN_PARAMETER_DECLARATION, // 91
    
    // synthetic tokens (not part of the CORBA spec but required for the parse tree)
    SYN_TYPENAME,
    
    // synthetic tokens combining other tokens
    SYN_LONGLONG,
    SYN_UNSIGNED_SHORT,
    SYN_UNSIGNED_LONG,
    SYN_UNSIGNED_LONGLONG,
    SYN_LONG_DOUBLE
}

export class Node
{
    type: Type
    text?: string
    
    typeParent: Node|undefined
    child: Array<Node|undefined>
    
    constructor(type: Type, text?: string) {
        this.type = type
        this.text = text
        this.child = new Array<Node|undefined>()
    }
    
    toString(): string {
        switch(this.type) {
            case Type.NONE:            return "none"
            
            case Type.TKN_TEXT:        return "text '"+this.text+"'"
            case Type.TKN_IDENTIFIER:  return "identifier '"+this.text+"'"
            case Type.TKN_COLON_COLON: return "::"

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

            case Type.SYN_SPECIFICATION:          return "SYN_SPECIFICATION" // 1
            case Type.SYN_INTERFACE:              return "SYN_INTERFACE" // 5
            case Type.SYN_INTERFACE_HEADER:       return "SYN_INTERFACE_HEADER" // 7
            case Type.SYN_INTERFACE_BODY:         return "SYN_INTERFACE_BODY" // 8
            case Type.SYN_VALUE_HEADER:           return "SYN_VALUE_HEADER" // 18
            case Type.SYN_VALUE_INHERITANCE_SPEC: return "SYN_VALUE_INHERITANCE_SPEC" // 19
            case Type.SYN_STATE_MEMBER:           return "SYN_STATE_MEMBER" // 22
            case Type.SYN_TYPE_DECLARATOR:        return "SYN_TYPE_DECLARATOR"
            case Type.SYN_DECLARATORS:            return "SYN_DECLARATORS" // 49
            case Type.SYN_MEMBER_LIST:            return "SYN_MEMBER_LIST" // 70
            case Type.SYN_MEMBER:                 return "SYN_MEMBER" // 71
            case Type.SYN_SWITCH_BODY:            return "SYN_SWITCH_BODY" // 74
            case Type.SYN_OPERATION_DECLARATION:  return "SYN_OPERATION_DECLARATION" // 87
    
            case Type.SYN_PARAMETER_DECLARATIONS: return "SYN_PARAMETER_DECLARATIONS" // 90
            case Type.SYN_PARAMETER_DECLARATION:  return "SYN_PARAMETER_DECLARATION" // 91
            
            case Type.SYN_TYPENAME:               return "SYN_TYPENAME"

            case Type.SYN_LONGLONG:               return "long long"
            case Type.SYN_UNSIGNED_SHORT:         return "unsigned short"
            case Type.SYN_UNSIGNED_LONG:          return "unsigned long"
            case Type.SYN_UNSIGNED_LONGLONG:      return "unsigned long long"
            case Type.SYN_LONG_DOUBLE:            return "long double"
        }
        throw Error("Node.toString(): unknown type "+String(this.type))
    }

    printTree(depth: number = 0) {
        let indent = ""
        for(let i=0; i<depth; ++i)
            indent = indent + "    "
        console.log(indent+this.toString())
        for(let c of this.child) {
            if (c===undefined) {
                console.log(indent+"    undefined")
            } else {
                c.printTree(depth+1)
            }
        }
    }
    append(node: Node | undefined): void {
        this.child.push(node)
    }
    prepend(node: Node | undefined): void {
        this.child.unshift(node)
    }

}
