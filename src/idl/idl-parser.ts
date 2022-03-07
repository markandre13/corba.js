/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018, 2020, 2021 Mark-André Hopf <mhopf@mark13.org>
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
import { Lexer } from "./idl-lexer"

let lexer: Lexer
let scoper: ScopeManager

// CORBA 3.3 Part 1 Interface, 7.4 IDL Grammar

// 1
export function specification(aLexer: Lexer): Node | undefined {
    lexer = aLexer
    scoper = new ScopeManager()

    let node = new Node(Type.SYN_SPECIFICATION)
    while (true) {
        let t0 = definition()
        if (t0 === undefined)
            break
        node.append(t0)
    }

    const tail = lexer.lex()
    if (tail !== undefined) {
        // if (node)
        //     node.printTree()

        throw Error(`Unparsed token '${tail.toString()}' at end of specification.`)
    }

    return node
}

// 2
function definition(): Node | undefined {
    let t0
    t0 = type_dcl()
    // if (t0 === undefined)
    //     t0 = const_dcl()
    if (t0 === undefined)
        t0 = except_dcl()
    if (t0 === undefined)
        t0 = _interface()
    if (t0 === undefined)
        t0 = _module()
    if (t0 === undefined)
        t0 = value()

    if (t0 !== undefined) {
        expect(';')
    }
    return t0
}

// 3
function _module(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_MODULE) {
        let t1 = identifier()
        if (t1 === undefined)
            throw Error("expected identifier after 'module'")
        t0.text = t1.text
        expect("{")
        scoper.enterModule(t0)
        while (true) {
            let t2 = definition()
            if (t2 === undefined)
                break
            if (t2.type == Type.TKN_NATIVE)
                throw Error("'native' can not be used within 'module'")
            t0.append(t2)
        }
        expect("}")
        scoper.leaveModule(t0)
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 4
function _interface(): Node | undefined {
    return interface_dcl()
}

// 5
function interface_dcl(): Node | undefined {
    let t0 = interface_header()
    if (!t0) {
        t0 = lexer.lex()
        if (t0) {
            lexer.unlex(t0)
        }
        return undefined
    }
    let t1 = lexer.lex()
    if (t1 === undefined)
        throw Error("expected { after interface header but got end of file")
    if (t1.type !== Type.TKN_TEXT && t1.text != '{')
        throw Error(`expected { after interface header but got ${t0}`)

    let node = new Node(Type.SYN_INTERFACE, t0.child[1]!.text)
    scoper.addType(t0.child[1]!.text!, node)
    node.append(t0)

    let t2 = interface_body()
    node.append(t2)

    let t3 = lexer.lex()
    if (!t3)
        throw Error("unexpected end of file")
    if (t3.type !== Type.TKN_TEXT && t3.text != '}')
        throw Error(`expected } after interface body but got '${t3}'`)

    return node
}

// 7
function interface_header(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    let t1
    if (t0.type !== Type.TKN_ABSTRACT && t0.type !== Type.TKN_LOCAL) {
        t1 = t0
        t0 = undefined
    } else {
        t1 = lexer.lex()
    }
    if (t1 === undefined) {
        lexer.unlex(t0)
        return undefined
    }
    if (t1.type !== Type.TKN_INTERFACE) {
        lexer.unlex(t1)
        lexer.unlex(t0)
        return undefined
    }

    let t2 = identifier()
    if (t2 === undefined)
        throw Error("expected identifier after 'interface'")

    // let t3 = interface_inheritance_spec()
    let header = new Node(Type.SYN_INTERFACE_HEADER)
    header.append(t0)
    header.append(t2)
    header.append(undefined)
    return header
}

// 8
function interface_body(): Node {
    let body = new Node(Type.SYN_INTERFACE_BODY)
    while (true) {
        let t0 = _export()
        if (t0 === undefined)
            return body
        body.append(t0)
    }
}

// 9
function _export(): Node | undefined {
    let t0 = attr_dcl()
    if (t0 === undefined)
        t0 = op_dcl()
    if (t0 === undefined)
        return undefined
    expect(';')
    return t0
}

// 12
function scoped_name(): Node | undefined {
    let globalNamespaceToken = undefined
    let identifierToken = lexer.lex()

    if (identifierToken === undefined)
        return undefined

    if (identifierToken.type === Type.TKN_COLON_COLON) {
        globalNamespaceToken = identifierToken
        identifierToken = lexer.lex()
        if (identifierToken === undefined) {
            lexer.unlex(globalNamespaceToken)
            return undefined
        }
    }

    if (identifierToken.type !== Type.TKN_IDENTIFIER) {
        lexer.unlex(identifierToken)
        lexer.unlex(globalNamespaceToken)
        return undefined
    }

    let type
    if (globalNamespaceToken === undefined) {
        type = scoper.getType(identifierToken.text!)
    } else {
        type = scoper.getGlobalScope().getType(identifierToken.text!)
        throw Error(`No way known to translate '::${identifierToken.text}' to TypeScript`)
    }
    if (type === undefined) {
        throw Error(`unknown type ${identifierToken}`)
    }

    identifierToken.append(type)
    if (type.type === Type.TKN_MODULE) {
        resolve_module(identifierToken, type)
    }
    if (type.type === Type.TKN_NATIVE &&
        type.text!.length > 4 &&
        type.text!.substring(type.text!.length - 4) === "_ptr" &&
        type.typeParent === undefined) {
        type.typeParent = scoper.getType(type.text!.substring(0, type.text!.length - 4))
    }
    return identifierToken
}

// 13
function value(): Node | undefined {
    let t0
    t0 = value_dcl()
    if (t0 !== undefined)
        return t0
    t0 = value_abs_dcl()
    if (t0 !== undefined)
        return t0
    t0 = value_box_dcl()
    if (t0 !== undefined)
        return t0
    t0 = value_forward_dcl()
    if (t0 !== undefined)
        return t0
    return undefined
}

// 14
function value_forward_dcl(): Node | undefined {
    return undefined
}

// 15
function value_box_dcl(): Node | undefined {
    return undefined
}

// 16
function value_abs_dcl(): Node | undefined {
    return undefined
}

// 17
function value_dcl(): Node | undefined {
    let header = value_header()
    if (header === undefined) {
        return undefined
    }

    expect('{')

    let node = new Node(Type.TKN_VALUETYPE)
    node.append(header)

    let identifier = header.child[1]!.text!

    node.text = identifier
    scoper.addType(identifier, node)

    while (true) {
        let t1 = value_element()
        if (t1 === undefined)
            break
        node.append(t1)
    }

    expect('}') // , "valuetype attributes must be prefixed with either 'public' or 'private'")

    return node
}

// 18
function value_header(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined) {
        let t1
        if (t0.type === Type.TKN_CUSTOM) {
            // "custom" means a customer marshaller
            throw Error("corba.js currently does not support custom valuetypes")
            // t1 = lexer.lex()
        } else {
            t1 = t0
            t0 = undefined
        }
        if (t1 !== undefined && t1.type === Type.TKN_VALUETYPE) {
            let t2 = identifier()
            if (t2 === undefined)
                throw Error("expected an identifier after valuetype")
            let t3 = value_inheritance_spec()

            let node = new Node(Type.SYN_VALUE_HEADER)
            node.append(t0)
            node.append(t2)
            node.append(t3)
            return node
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 19
function value_inheritance_spec(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 === undefined || t0.type !== Type.TKN_TEXT || t0.text !== ":") {
        lexer.unlex(t0)
        return undefined
    }

    let t1 = lexer.lex()
    if (t1 !== undefined && t1.type !== Type.TKN_TRUNCATABLE) {
        lexer.unlex(t1)
        t1 = undefined
    }
    if (t1 !== undefined)
        throw Error("'truncatable' is not supported")

    let node = new Node(Type.SYN_VALUE_INHERITANCE_SPEC)
    node.append(t1)

    while (true) {
        let t2 = value_name()
        if (t2 === undefined) {
            throw Error("expected a value name after '" + t0.text + "'")
        }
        node.append(t2)
        let t3 = lexer.lex()
        if (t3 === undefined)
            throw Error("unexpected end of file")
        if (t3.type !== Type.TKN_TEXT || t3.text !== ",") {
            lexer.unlex(t3)
            break
        }
        t0 = value_name()
        if (t0 === undefined)
            throw Error("expected a value name after ':'")
    }
    return node
}

// 20
function value_name(): Node | undefined {
    return scoped_name()
}

// 21
function value_element(): Node | undefined {
    let t0 = _export()
    if (t0 === undefined)
        t0 = state_member()
    /*
        if (t0 === undefined)
            t0 = init_dcl()
    */
    return t0
}

// 22
function state_member(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type !== Type.TKN_PUBLIC && t0.type !== Type.TKN_PRIVATE) {
        lexer.unlex(t0)
        return undefined
    }

    let t1 = type_spec()
    if (t1 === undefined) {
        lexer.unlex(t0)
        return undefined
    }

    let t2 = declarators()
    if (t2 === undefined) {
        throw Error("expected declarators")
    }

    expect(";")

    let node = new Node(Type.SYN_STATE_MEMBER)
    node.append(t0)
    node.append(t1)
    node.append(t2)
    return node
}

// 29
// function const_exp() {
//     // return or_expr()
//     return literal()
// }

// 30
// function or_expr() {
//     let t0 = xor_expr()
//     if (t0 !== undefined)
//         return t0
//     t0 = or_expr()
//     let t1 = lexer.lex()
//     if (t1 !== Type.TKN_)
// }

// 39
// function literal() {
//     let t0
//     t0 = integer_literal()
//     if (t0)
//         return t0
//     t0 = string_literal()
//     if (t0)
//         return t0
//     t0 = wide_string_literal()
//     if (t0)
//         return t0
//     t0 = character_literal()
//     if (t0)
//         return t0
//     t0 = wide_character_literal()
//     if (t0)
//         return t0
//     t0 = fixed_pt_literal()
//     if (t0)
//         return t0
//     t0 = floating_pt_literal()
//     if (t0)
//         return t0
//     return boolean_literal()
// }

// 40
// function boolean_literal() {
//     let t0 = lexer.lex()
//     if (t0 === undefined)
//         return undefined
//     if (t0.type === Type.TKN_TRUE || t0.type === Type.TKN_FALSE) {
//         return t0
//     }
//     lexer.unlex(t0)
//     return undefined
// }

// 42
function type_dcl(): Node | undefined {

    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_TYPEDEF) {
        let t1 = type_declarator()
        if (t1 === undefined) {
            lexer.unlex(t0)
            return undefined
        }
        const identifiers = t1.child[1]!.child!
        for(const id of identifiers) {
            scoper.addType(id!.text!, t1.child[0]!)
        }
        t1.type = t0.type
        return t1
    }
    lexer.unlex(t0)

    t0 = struct_type()
    if (t0 !== undefined)
        return t0

    t0 = union_type()
    if (t0 !== undefined)
        return t0;

    t0 = enum_type()
    if (t0 !== undefined)
        return t0;

    t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_NATIVE) {
        let t1 = simple_declarator()
        if (t1 === undefined) {
            throw Error("expected simple declarator after 'native'")
        }
        t0.append(t1)
        t0.text = t1.text
        scoper.addType(t1.text!, t0)
        return t0
    }
    lexer.unlex(t0)

    // t0 = constr_forward_decl()
    // if (t0 !== undefined)
    //     return t0

    return undefined
}

// 43
function type_declarator(): Node | undefined {
    const t0 = type_spec()
    if (t0 === undefined)
        return undefined
    const t1 = declarators()
    if (t1 == undefined) {
        throw Error("expected at least one declarator")
    }
    const n = new Node(Type.SYN_TYPE_DECLARATOR)
    n.append(t0)
    n.append(t1)
    return n
}

// 44
function type_spec(): Node | undefined {
    let t0
    t0 = simple_type_spec()
    if (t0 === undefined)
        t0 = constr_type_spec()
    return t0
}

// 45
function simple_type_spec(): Node | undefined {
    let t0
    t0 = base_type_spec()
    if (t0 === undefined)
        t0 = template_type_spec()
    if (t0 === undefined)
        t0 = scoped_name()
    return t0
}

// 46
function base_type_spec(): Node | undefined {
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

// 47
function template_type_spec(): Node | undefined {
    let t0
    t0 = sequence_type()
    if (t0 !== undefined)
        return t0
    t0 = string_type()
    if (t0 !== undefined)
        return t0
    t0 = wide_string_type()
    if (t0 !== undefined)
        return t0
    /*
        t0 = fixed_pt_type()
        if (t0 !== undefined)
            return t0
    */
    return undefined
}

// 48 constructed type specification
function constr_type_spec() {
    let t0 = struct_type()
    if (t0 === undefined)
        t0 = union_type()
    if (t0 === undefined)
        t0 = enum_type()
    return t0
}

// 49
function declarators(): Node | undefined {
    let t0 = declarator()
    if (t0 === undefined)
        return undefined
    let node = new Node(Type.SYN_DECLARATORS)
    while (true) {
        node.append(t0)
        let t1 = lexer.lex()
        if (t1 === undefined || t1.type !== Type.TKN_TEXT || t1.text !== ",") {
            lexer.unlex(t1)
            break
        }
        t0 = declarator()
        if (t0 === undefined)
            throw Error("expected another declarator after ','")
    }
    return node
}

// 50
function declarator(): Node | undefined {
    let t0
    t0 = simple_declarator()
    /*
        if (t0 === undefined)
            t0 = complex_declarator()
    */
    return t0
}

// 51
function simple_declarator(): Node | undefined {
    return identifier()
}

// 53
function floating_pt_type(): Node | undefined {
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
            t1.type = Type.SYN_LONG_DOUBLE
            return t1
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 54
function integer_type(): Node | undefined {
    let t0
    t0 = signed_int()
    if (t0 !== undefined)
        return t0
    t0 = unsigned_int()
    if (t0 !== undefined) {
        return t0
    }

    t0 = lexer.lex()
    if (t0 !== undefined && [Type.TKN_SHORT, Type.TKN_LONG, Type.TKN_UNSIGNED].includes(t0.type)) {
        throw Error('valid integer types are: short, unsigned short, long, unsigned long, long long, unsigned long long')
    }
    lexer.unlex(t0)

    return undefined
}

// 55
function signed_int(): Node | undefined {
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
function signed_short_int(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_SHORT)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 57
function signed_long_int(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === Type.TKN_LONG)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 58
function signed_longlong_int(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_LONG) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            t0.type = Type.SYN_LONGLONG
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 59
function unsigned_int(): Node | undefined {
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
function unsigned_short_int(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_SHORT) {
            t0.type = Type.SYN_UNSIGNED_SHORT
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 61
function unsigned_long_int(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            t0.type = Type.SYN_UNSIGNED_LONG
            return t0
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 62
function unsigned_longlong_int(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            let t2 = lexer.lex()
            if (t2 !== undefined && t2.type === Type.TKN_LONG) {
                t0.type = Type.SYN_UNSIGNED_LONGLONG
                return t0
            }
            lexer.unlex(t2)
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 63
function char_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_CHAR)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 64
function wide_char_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_WCHAR)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 65
function boolean_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_BOOLEAN)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 66
function octet_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_OCTET)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 67
function any_type(): Node | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_ANY)
        return t0
    lexer.unlex(t0)
    return undefined
}

// 69
function struct_type(): Node | undefined {
    const t0 = lexer.lex()
    if (t0 === undefined || t0.type !== Type.TKN_STRUCT) {
        lexer.unlex(t0)
        return undefined
    }
    const t1 = identifier()
    if (t1 === undefined)
        throw Error("expected identifier after 'struct'")
    expect('{')
    const t2 = member_list()
    if (t2 === undefined)
        throw Error("expected at least one member within 'struct'")
    expect('}')

    t2.type = t0.type
    t2.text = t1.text
    scoper.addType(t2.text!, t2)

    return t2
}

// 70
function member_list(): Node | undefined {
    const t0 = member()
    if (t0 === undefined)
        return undefined
    const node = new Node(Type.SYN_MEMBER_LIST)
    node.append(t0)
        
    while(true) {
        const t1 = member()
        if (t1 === undefined)
            break
        node.append(t1)
    }
    return node
}

// 71
function member(): Node | undefined {
    const node = new Node(Type.SYN_MEMBER)
    const t0 = type_spec()
    if (t0 === undefined)
        return undefined
    const t1 = declarators()
    if (t1 === undefined)
        throw Error(`expected declarators after type_spec ${t0.toString()}`)
    expect(";")
    node.append(t0)
    node.append(t1)
    return node
}

// 72
function union_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type !== Type.TKN_UNION) {
        lexer.unlex(t0)
        return undefined
    }

    let t1 = identifier()
    if (t1 === undefined)
        throw Error(`expected identifier after 'union'`)
    let t2 = lexer.lex()
    if (t2 === undefined || t2.type !== Type.TKN_SWITCH) {
        throw Error(`expected 'switch' after union <identifier>`)
    }
    expect("(")
    let t3 = switch_type_spec()
    if (t3 === undefined) {
        throw Error(`expected switch type specifier after union <identifier> switch(`)
    }
    expect(")")
    expect("{")
    let t4 = switch_body()
    expect("}")

    t0.text = t1.text
    t0.append(t3)
    t0.append(t4)

    scoper.addType(t0.text!, t0)

    return t0
}

// 73
function switch_type_spec() {
    let t0 = integer_type()
    if (t0 !== undefined)
        throw Error(`integer type is not implemented yet`)
    t0 = char_type()
    if (t0 !== undefined)
        throw Error(`char type is not implemented yet`)
    t0 = boolean_type()
    if (t0 !== undefined)
        throw Error(`boolean type is not implemented yet`)
    t0 = enum_type()
    if (t0 !== undefined)
        return t0
    return scoped_name()
}

// 74
function switch_body() {
    let t0 = new Node(Type.SYN_SWITCH_BODY)
    while(true) {
        const t1 = _case()
        if (t1 === undefined)
            break
        t0.append(t1)
    }
    return t0
}

// 75
function _case() {
    let t0 = case_label()
    if (t0 === undefined)
        return t0
    let t1 = element_spec()
    if (t1 === undefined)
        throw Error(`expected element specification after '${t0}'`)
    t0.append(t1.child[0])
    t0.append(t1.child[1])
    expect(";")
    return t0
}

// 76
function case_label() {
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === Type.TKN_CASE) {
        // TODO: enum only hack, should use const_exp() instead
        let t1 = identifier()
        if (t1 === undefined) {
            throw Error(`expected enum identifier after 'case'`)
        }
        const t = scoper.getType(t1!.text!)
        if (t?.typeParent?.type === Type.TKN_ENUM) {
        } else {
            throw Error(`unsupported value after 'case'`)
        }
        expect(":")
        t0.append(t)
        return t0
    }
    if (t0.type === Type.TKN_DEFAULT) {
        expect(":")
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 77
function element_spec() {
    let t0 = type_spec()
    if (t0 === undefined)
        return undefined
    let t1 = declarator()
    if (t1 === undefined)
        throw Error(`expected declarator after ${t0}`)
    let t2 = new Node(Type.NONE)
    t2.append(t0)
    t2.append(t1)
    return t2
}

// 78
function enum_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_ENUM) {
        const t1 = identifier()
        if (t1 === undefined)
            throw Error("expected identifier after 'enum'")
        t0.text = t1.text
        expect("{")
        const usedNames = new Set<string>()
        while (true) {
            // node.append(t0)
            let t2 = lexer.lex()
            if (t2 === undefined)
                throw Error("unexpected end of file")
            if (t2.type !== Type.TKN_IDENTIFIER)
                throw Error("expected identifier but got ${t2}")
            if (usedNames.has(t2.text!)) {
                throw Error(`Declaration of enumerator '${t2.text}' clashes with earlier declaration of enumerator '${t2.text}'`)
            }
            usedNames.add(t2.text!)

            scoper.addType(t2.text!, t2)
            t0.append(t2)
            t2.typeParent = t0

            let t3 = lexer.lex()
            if (t3 === undefined)
                throw Error("unexpected end of file")
            if (t3.type !== Type.TKN_TEXT)
                throw Error("expected ',' or '}' but got ${t2}")
            if (t3.text === "}")
                break              
        }
        scoper.addType(t0!.text!, t0)
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 80
function sequence_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_SEQUENCE) {
        // "sequence" "<" simple_type_spec "," positive_int_const ">"
        expect("<")
        let t1 = simple_type_spec()
        if (t1 === undefined)
            throw Error("expected type after 'sequence <'")
        expect(">")
        t0.append(t1)
        t0.append(undefined)
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 81
function string_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_STRING) {
        // 'string' '<' <positive_int_const> '>'
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 82
function wide_string_type(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_WSTRING) {
        // 'wstring' '<' <positive_int_const> '>'
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 85
function attr_dcl(): Node | undefined {
    let t0
    t0 = readonly_attr_spec()
    if (t0 === undefined)
        t0 = attr_spec()
    return t0
}

// 86
function except_dcl(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 === undefined || t0.type != Type.TKN_EXCEPTION) {
        lexer.unlex(t0)
        return undefined
    }
    let t1 = identifier()
    if (t1 === undefined)
        throw Error(`expected identifier after '${t0.toString()}'`)

    t0.text = t1.text
    expect("{")
    while(true) {
        let t2 = member()
        if (t2 === undefined)
            break
        t0.append(t2)
    }
    expect("}")

    scoper.addType(t0.text!, t0)
    
    return t0
}


// 87 (Operation Declaration)
function op_dcl(): Node | undefined {
    const t0 = op_attribute() // opt
    const t1 = op_type_spec()
    if (t1 === undefined) {
        lexer.unlex(t0)
        return undefined
    }
    const t2 = identifier()
    if (t2 === undefined) {
        throw Error(`expected identifier after '${t1.toString()}'`)
    }
    const t3 = parameter_dcls()
    if (t3 === undefined) {
        // throw Error("expected parameter declaration after "+t2.toString())
        lexer.unlex(t2)
        // FIXME: missing private or public in valuetype caused this. also: we don't use the private/public declarators yet
        if (t1.child.length != 0) {
            throw Error("expected parameter declaration after "+t2.toString())
        }
        lexer.unlex(t1)
        lexer.unlex(t0)
        return undefined
    }
    const t4 = raises_expr()
    // const t5 = context_expr()

    let node = new Node(Type.SYN_OPERATION_DECLARATION)
    node.append(t0)
    node.append(t1)
    node.append(t2)
    node.append(t3)
    node.append(t4)
    node.append(undefined)
    return node
}

// 88
function op_attribute(): Node | undefined {
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
function op_type_spec(): Node | undefined {
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
function parameter_dcls(): Node | undefined {
    let t0 = lexer.lex()
    if (!t0) {
        return undefined
    }
    if (t0.type !== Type.TKN_TEXT || t0.text !== '(') {
        lexer.unlex(t0)
        return undefined
    }

    let declarations = new Node(Type.SYN_PARAMETER_DECLARATIONS)
    while (true) {
        let t1 = param_dcl()
        if (t1 !== undefined)
            declarations.append(t1)

        let t2 = lexer.lex()

        if (t2 !== undefined && t2.type === Type.TKN_TEXT && t2.text === ')') {
            break
        }
        if (t2 !== undefined && t2.type === Type.TKN_TEXT && t2.text === ",") {
            continue
        }
        if (t2 !== undefined)
            throw Error("expected 'in', 'out', 'inout' or ')' to end for parameter declaration but got " + t2.toString())
        else
            throw Error("expected 'in', 'out', 'inout' or ')' to end for parameter declaration but end of file")
    }
    return declarations
}

// 91
function param_dcl(): Node | undefined {
    let t0 = param_attribute()
    if (t0 === undefined)
        return undefined

    let t1 = param_type_spec()
    if (t1 === undefined) {
        t1 = lexer.lex()
        if (t1 !== undefined)
            throw Error("expected type specification but got " + t1.toString())
        else
            throw Error("expected type specification but found end of file")
    }

    let t2 = simple_declarator()
    if (t2 === undefined) {
        throw Error("Missing parameter name.")
    }

    let declaration = new Node(Type.SYN_PARAMETER_DECLARATION)
    declaration.append(t0)
    declaration.append(t1)
    declaration.append(t2)
    return declaration
}

// 92
function param_attribute(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    switch (t0.type) {
        case Type.TKN_IN:
        case Type.TKN_OUT:
        case Type.TKN_INOUT:
            return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 93
function raises_expr(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 === undefined || t0.type !== Type.TKN_RAISES) {
        lexer.unlex(t0)
        return undefined
    }
    expect("(")
    let t1 = scoped_name()
    if (t1 === undefined)
        throw Error(`expected exception name after 'raises('`)
    if (t1.child[0] === undefined || t1.child[0].type !== Type.TKN_EXCEPTION)
        throw Error(`expected ${t1.toString()} to be an exception`)
    if (t1.type)
    t0.append(t1)
    while(true) {
        let t2 = lexer.lex()
        if (t2 === undefined || t2.type !== Type.TKN_TEXT || t0.text !== ",") {
            lexer.unlex(t2)
            break
        }
        t1 = scoped_name()
        if (t1 === undefined)
            throw Error(`expected exception name after 'raises(..., '`)
        if (t1.child[0] === undefined || t1.child[0].type !== Type.TKN_EXCEPTION)
            throw Error(`expected ${t1.toString()} to be an exception`)
        t0.append(t1)
    }
    expect(")")
    return t0
}

// 95
function param_type_spec(): Node | undefined {
    let t0
    t0 = base_type_spec()
    if (t0 !== undefined)
        return t0
    t0 = template_type_spec()	// not in the CORBA specs but MICO does this, usually an typedef would be required for this
    if (t0 !== undefined)
        return t0
    /*
        t0 = string_type()
        if (t0 !== undefined)
            return t0
        t0 = wide_string_type()
        if (t0 !== undefined)
            return t0
    */
    t0 = scoped_name()
    if (t0)
        return t0
    return undefined
}

// 104
function readonly_attr_spec(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_READONLY) {
        let t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_ATTRIBUTE) {
            let t2 = param_type_spec()
            if (t2 === undefined)
                throw Error("expected type specifier after 'readonly attribute'")
            let t3 = readonly_attr_declarator()
            if (t3 === undefined)
                throw Error("expected declarator for 'readonly attribute'")
            t1.append(t0)
            t1.append(t2)
            t1.append(t3)
            return t1
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 105
function readonly_attr_declarator(): Node | undefined {
    let t0 = simple_declarator()
    if (t0 === undefined)
        return undefined
    let node = new Node(Type.SYN_DECLARATORS)
    while (true) {
        node.append(t0)
        let t1 = lexer.lex()
        if (t1 === undefined || t1.type !== Type.TKN_TEXT || t1.text! !== ",") {
            lexer.unlex(t1)
            return node
        }
        t0 = simple_declarator()
        if (t0 === undefined)
            throw Error("expected another declarator after ','")
    }
}

// 106
function attr_spec(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_ATTRIBUTE) {
        let t1 = param_type_spec()
        if (t1 === undefined)
            throw Error("expected type specifier after 'attribute'")
        let t2 = attr_declarator()
        if (t2 === undefined)
            throw Error("expected declarator for 'attribute'")
        t0.append(undefined)
        t0.append(t1)
        t0.append(t2)
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

// 107
function attr_declarator(): Node | undefined {
    let t0 = simple_declarator()
    if (t0 === undefined)
        return undefined
    let node = new Node(Type.SYN_DECLARATORS)
    while (true) {
        node.append(t0)
        let t1 = lexer.lex()
        if (t1 === undefined || t1.type !== Type.TKN_TEXT || t1.text! !== ",") {
            lexer.unlex(t1)
            return node
        }
        t0 = simple_declarator()
        if (t0 === undefined)
            throw Error("expected another declarator after ','")
    }
}

function identifier(): Node | undefined {
    let t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_IDENTIFIER)
        return t0
    lexer.unlex(t0)
    return undefined
}

function expect(text: string, customMessage?: string): void {
    let t0 = lexer.lex()
    let errorMessage
    if (customMessage === undefined)
        errorMessage = `expected '${text}' but got '${t0?.toString()}'`
    else
        errorMessage = customMessage

    if (t0 === undefined)
        throw Error(errorMessage + " but found end of file")
    if (t0.type !== Type.TKN_TEXT || t0.text !== text) {
        throw Error(errorMessage)
    }
}

class Scope {
    node: Node | undefined
    types: Map<string, Node>
    modules: Map<string, Node>
    constructor(node: Node | undefined) {
        this.node = node
        this.types = new Map<string, Node>()
        this.modules = new Map<string, Node>()
    }
    addType(name: string, type: Node): void {
        if (this.types.has(name))
            throw Error("duplicate typename '" + name + "'")
        this.types.set(name, type)
        type.typeParent = this.node
    }
    getType(name: string): Node | undefined {
        return this.types.get(name)
    }
}

class ScopeManager {
    stack: Array<Scope>
    constructor() {
        this.stack = new Array<Scope>()
        this.stack.push(new Scope(undefined))
    }
    getGlobalScope(): Scope {
        return this.stack[0]
    }
    getCurrentScope(): Scope {
        return this.stack[this.stack.length - 1]
    }
    addType(name: string, type: Node): void {
        this.getCurrentScope().addType(name, type)
    }
    getType(name: string): Node | undefined {
        for (let i = this.stack.length - 1; i >= 0; --i) {
            let type = this.stack[i].getType(name)
            if (type !== undefined)
                return type
        }
        return undefined
    }
    enterModule(node: Node) {
        this.getCurrentScope().addType(node.text!, node)
        this.stack.push(new Scope(node))
    }
    leaveModule(node: Node) {
        this.stack.pop()
    }
}

function resolve_module(identifierToken: Node, module: Node) {
    const paamayimNekudotayim = lexer.lex()
    if (paamayimNekudotayim === undefined || paamayimNekudotayim.type !== Type.TKN_COLON_COLON)
        throw Error(`Expected :: after module identifier '${identifierToken.text}'`)

        const identifier = lexer.lex()
    if (identifier === undefined || identifier.type !== Type.TKN_IDENTIFIER)
        throw Error(`Expected identifier after ::'`)

        for (let child of module.child) {
        switch (child?.type) {
            case Type.TKN_MODULE:
                if (child.text === identifier.text) {
                    identifierToken.append(child)
                    resolve_module(identifierToken, child)
                    return
                }
                break
            case Type.TKN_NATIVE:
            case Type.TKN_VALUETYPE:
                if (child.text === identifier.text) {
                    identifierToken.append(child)
                    return
                }
                break
            case Type.SYN_INTERFACE:
                if (child.child[0]!.child[1]!.text === identifier.text) {
                    identifierToken.append(child)
                    return
                }
                break
        }
    }
    throw Error(`failed to lookup ${identifier.text}`)
}
