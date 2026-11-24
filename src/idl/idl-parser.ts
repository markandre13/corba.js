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

import {
    Type, Token, Annotation, Specification, Definition, BaseType, StringType, SequenceType, ScopedName,
    TypeSpec, Declaration, Member, StructDecl, ExceptionDecl, Enumerator, EnumDecl, SwitchCase, UnionDecl,
    TypedefDecl, NativeDecl, ModuleDecl, InterfaceDecl, ValueTypeDecl, Operation, Attribute, StateMember,
    Parameter, Export
} from "./idl-node"
import { Lexer, describeToken } from "./idl-lexer"

let lexer: Lexer
let scoper: ScopeManager

// CORBA 3.3 Part 1 Interface, 7.4 IDL Grammar

// 1
export function specification(aLexer: Lexer): Specification | undefined {
    lexer = aLexer
    scoper = new ScopeManager()

    const definitions: Definition[] = []
    while (true) {
        const t0 = definition()
        if (t0 === undefined)
            break
        definitions.push(t0)
    }

    const tail = lexer.lex()
    if (tail !== undefined) {
        throw Error(`Unparsed token '${describeToken(tail)}' at end of specification.`)
    }

    return { type: Type.SYN_SPECIFICATION, definitions }
}

// 2
function definition(): Definition | undefined {
    let t0: Definition | undefined
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
function _module(): ModuleDecl | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_MODULE) {
        const t1 = identifier()
        if (t1 === undefined)
            throw Error("expected identifier after 'module'")
        const node: ModuleDecl = { type: Type.TKN_MODULE, name: t1.text!, parent: scoper.getCurrentScope().node, definitions: [] }
        expect("{")
        scoper.enterModule(node)
        while (true) {
            const t2 = definition()
            if (t2 === undefined)
                break
            if (t2.type == Type.TKN_NATIVE)
                throw Error("'native' can not be used within 'module'")
            node.definitions.push(t2)
        }
        expect("}")
        scoper.leaveModule()
        return node
    }
    lexer.unlex(t0)
    return undefined
}

// 4
function _interface(): InterfaceDecl | undefined {
    return interface_dcl()
}

// 5
function interface_dcl(): InterfaceDecl | undefined {
    const doc = docBefore()
    const t0 = interface_header()
    if (!t0) {
        const t = lexer.lex()
        if (t) {
            lexer.unlex(t)
        }
        return undefined
    }
    const t1 = lexer.lex()
    if (t1 === undefined)
        throw Error("expected { after interface header but got end of file")
    if (t1.type !== Type.TKN_TEXT && t1.text != '{')
        throw Error(`expected { after interface header but got ${describeToken(t1)}`)

    const node: InterfaceDecl = { type: Type.SYN_INTERFACE, name: t0.name, modifier: t0.modifier, base: t0.base, body: [], doc }
    scoper.addType(node.name, node)

    node.body = interface_body()

    const t3 = lexer.lex()
    if (!t3)
        throw Error("unexpected end of file")
    if (t3.type !== Type.TKN_TEXT && t3.text != '}')
        throw Error(`expected } after interface body but got '${describeToken(t3)}'`)

    return node
}

// 7
function interface_header(): { name: string, modifier?: Type.TKN_ABSTRACT | Type.TKN_LOCAL, base?: ScopedName } | undefined {
    const t0 = lexer.lex()
    if (t0 === undefined) {
        return undefined
    }
    let modifier: Type.TKN_ABSTRACT | Type.TKN_LOCAL | undefined = undefined
    let t1: Token | undefined = t0
    if (t0.type === Type.TKN_ABSTRACT || t0.type === Type.TKN_LOCAL) {
        modifier = t0.type
        t1 = lexer.lex()
    }
    if (t1 === undefined) {
        lexer.unlex(t0)
        return undefined
    }
    if (t1.type !== Type.TKN_INTERFACE) {
        lexer.unlex(t1)
        if (modifier !== undefined)
            lexer.unlex(t0)
        return undefined
    }

    const t2 = identifier()
    if (t2 === undefined) {
        throw Error("expected identifier after 'interface'")
    }

    const base = interface_inheritance_spec()

    return { name: t2.text!, modifier, base }
}

// 8
function interface_body(): Export[] {
    const body: Export[] = []
    while (true) {
        const t0 = _export()
        if (t0 === undefined)
            return body
        body.push(t0)
    }
}

// 9
function _export(): Export | undefined {
    let t0: Export | undefined = attr_dcl()
    if (t0 === undefined)
        t0 = op_dcl()
    if (t0 === undefined)
        return undefined
    expect(';')
    return t0
}

// 10
function interface_inheritance_spec(): ScopedName | undefined {
    let token = lexer.lex()
    if (token === undefined) {
        return undefined
    }
    if (token.type !== Type.TKN_TEXT || token.text !== ':') {
        lexer.unlex(token)
        return undefined
    }

    const id = identifier()
    if (id === undefined) {
        throw Error("expected identifier naming the super class after ':'")
    }

    token = lexer.lex()
    if (token !== undefined && token.type === Type.TKN_TEXT && token.text === ",") {
        throw Error("multiple inheritance is not implemented in corba.js")
    }
    lexer.unlex(token)

    const entry = scoper.getType(id.text!)
    if (entry === undefined) {
        throw Error(`undefined interface ${id.text}`)
    }

    return makeScopedName(id.text!, [], entry)
}

// 12
function scoped_name(): ScopedName | undefined {
    let globalNamespaceToken: Token | undefined = undefined
    let identifierToken = lexer.lex()

    if (identifierToken === undefined) {
        return undefined
    }

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

    if (globalNamespaceToken !== undefined) {
        throw Error(`No way known to translate '::${identifierToken.text}' to TypeScript`)
    }
    const entry = scoper.getType(identifierToken.text!)
    if (entry === undefined) {
        throw Error(`unknown type ${describeToken(identifierToken)}`)
    }

    if (entry.target.type === Type.TKN_NATIVE) {
        resolve_native_ptr(entry.target, entry.scope)
    }

    let current = entry
    let name = identifierToken.text!
    const path: ModuleDecl[] = []
    while (current.target.type === Type.TKN_MODULE) {
        const module = current.target
        path.push(module)
        resolve_module_separator(name)
        const identifier = lexer.lex()
        if (identifier === undefined || identifier.type !== Type.TKN_IDENTIFIER)
            throw Error(`Expected identifier after ::'`)
        const child = find_in_module(module, identifier.text!)
        if (child === undefined)
            throw Error(`failed to lookup ${identifier.text}`)
        name = identifier.text!
        current = { target: child, scope: module }
    }
    return makeScopedName(name, path, current)
}

// 13
function value(): ValueTypeDecl | undefined {
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
function value_forward_dcl(): ValueTypeDecl | undefined {
    return undefined
}

// 15
function value_box_dcl(): ValueTypeDecl | undefined {
    return undefined
}

// 16
function value_abs_dcl(): ValueTypeDecl | undefined {
    return undefined
}

// 17
function value_dcl(): ValueTypeDecl | undefined {
    const doc = docBefore()
    const header = value_header()
    if (header === undefined) {
        return undefined
    }

    expect('{')

    const node: ValueTypeDecl = { type: Type.TKN_VALUETYPE, name: header.name, base: header.base, elements: [], doc }
    scoper.addType(node.name, node)

    while (true) {
        const t1 = value_element()
        if (t1 === undefined)
            break
        node.elements.push(t1)
    }

    expect('}') // , "valuetype attributes must be prefixed with either 'public' or 'private'")

    return node
}

// 18
function value_header(): { name: string, base: ScopedName[] } | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined) {
        // "custom" means a customer marshaller
        if (t0.type === Type.TKN_CUSTOM)
            throw Error("corba.js currently does not support custom valuetypes")
        if (t0.type === Type.TKN_VALUETYPE) {
            const t2 = identifier()
            if (t2 === undefined)
                throw Error("expected an identifier after valuetype")
            const base = value_inheritance_spec()
            return { name: t2.text!, base }
        }
        lexer.unlex(t0)
    }
    return undefined
}

// 19
function value_inheritance_spec(): ScopedName[] {
    const t0 = lexer.lex()
    if (t0 === undefined || t0.type !== Type.TKN_TEXT || t0.text !== ":") {
        lexer.unlex(t0)
        return []
    }

    const t1 = lexer.lex()
    if (t1 !== undefined && t1.type === Type.TKN_TRUNCATABLE)
        throw Error("'truncatable' is not supported")
    lexer.unlex(t1)

    const base: ScopedName[] = []
    let separator = t0.text
    while (true) {
        const t2 = value_name()
        if (t2 === undefined) {
            throw Error("expected a value name after '" + separator + "'")
        }
        base.push(t2)
        const t3 = lexer.lex()
        if (t3 === undefined)
            throw Error("unexpected end of file")
        if (t3.type !== Type.TKN_TEXT || t3.text !== ",") {
            lexer.unlex(t3)
            break
        }
        separator = ","
    }
    return base
}

// 20
function value_name(): ScopedName | undefined {
    return scoped_name()
}

// 21
function value_element(): Export | StateMember | undefined {
    let t0: Export | StateMember | undefined = _export()
    if (t0 === undefined)
        t0 = state_member()
    /*
        if (t0 === undefined)
            t0 = init_dcl()
    */
    return t0
}

// 22
function state_member(): StateMember | undefined {
    const doc = docBefore()
    const t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type !== Type.TKN_PUBLIC && t0.type !== Type.TKN_PRIVATE) {
        lexer.unlex(t0)
        return undefined
    }

    const t1 = type_spec()
    if (t1 === undefined) {
        lexer.unlex(t0)
        return undefined
    }

    const names = declarators()
    if (names === undefined) {
        throw Error("expected declarators")
    }

    expect(";")

    return { type: Type.SYN_STATE_MEMBER, visibility: t0.type, typeSpec: t1, names, doc }
}

// 42
function type_dcl(): Definition | undefined {

    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_TYPEDEF) {
        const t1 = type_declarator()
        if (t1 === undefined) {
            lexer.unlex(t0)
            return undefined
        }
        for (const name of t1.names) {
            scoper.addType(name, t1.typeSpec)
        }
        return t1
    }
    lexer.unlex(t0)

    const t2 = struct_type()
    if (t2 !== undefined)
        return t2

    const t3 = union_type()
    if (t3 !== undefined)
        return t3

    const t4 = enum_type()
    if (t4 !== undefined)
        return t4

    const t5 = lexer.lex()
    if (t5 !== undefined && t5.type === Type.TKN_NATIVE) {
        const t6 = simple_declarator()
        if (t6 === undefined) {
            throw Error("expected simple declarator after 'native'")
        }
        const node: NativeDecl = { type: Type.TKN_NATIVE, name: t6.text! }
        scoper.addType(node.name, node)
        return node
    }
    lexer.unlex(t5)

    // t0 = constr_forward_decl()
    // if (t0 !== undefined)
    //     return t0

    return undefined
}

// 43
function type_declarator(): TypedefDecl | undefined {
    const t0 = type_spec()
    if (t0 === undefined)
        return undefined
    const names = declarators()
    if (names === undefined) {
        throw Error("expected at least one declarator")
    }
    return { type: Type.TKN_TYPEDEF, typeSpec: t0, names }
}

// 44
function type_spec(): TypeSpec | undefined {
    let t0: TypeSpec | undefined
    t0 = simple_type_spec()
    if (t0 === undefined)
        t0 = constr_type_spec()
    return t0
}

// 45
function simple_type_spec(): TypeSpec | undefined {
    let t0: TypeSpec | undefined
    t0 = base_type_spec()
    if (t0 === undefined)
        t0 = template_type_spec()
    if (t0 === undefined)
        t0 = scoped_name()
    return t0
}

// 46
function base_type_spec(): BaseType | undefined {
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
function template_type_spec(): SequenceType | StringType | undefined {
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
function constr_type_spec(): StructDecl | UnionDecl | EnumDecl | undefined {
    let t0: StructDecl | UnionDecl | EnumDecl | undefined = struct_type()
    if (t0 === undefined)
        t0 = union_type()
    if (t0 === undefined)
        t0 = enum_type()
    return t0
}

// 49
function declarators(): string[] | undefined {
    let t0: Token | undefined = declarator()
    if (t0 === undefined)
        return undefined
    const names: string[] = []
    while (true) {
        names.push(t0.text!)
        const t1 = lexer.lex()
        if (t1 === undefined || t1.type !== Type.TKN_TEXT || t1.text !== ",") {
            lexer.unlex(t1)
            break
        }
        t0 = declarator()
        if (t0 === undefined)
            throw Error("expected another declarator after ','")
    }
    return names
}

// 50
function declarator(): Token | undefined {
    let t0
    t0 = simple_declarator()
    /*
        if (t0 === undefined)
            t0 = complex_declarator()
    */
    return t0
}

// 51
function simple_declarator(): Token | undefined {
    return identifier()
}

// 53
function floating_pt_type(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === Type.TKN_FLOAT)
        return { type: Type.TKN_FLOAT }
    if (t0.type === Type.TKN_DOUBLE)
        return { type: Type.TKN_DOUBLE }
    if (t0.type === Type.TKN_LONG) {
        const t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_DOUBLE) {
            return { type: Type.SYN_LONG_DOUBLE }
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 54
function integer_type(): BaseType | undefined {
    let t0
    t0 = signed_int()
    if (t0 !== undefined)
        return t0
    t0 = unsigned_int()
    if (t0 !== undefined) {
        return t0
    }

    const t1 = lexer.lex()
    if (t1 !== undefined && [Type.TKN_SHORT, Type.TKN_LONG, Type.TKN_UNSIGNED].includes(t1.type)) {
        throw Error('valid integer types are: short, unsigned short, long, unsigned long, long long, unsigned long long')
    }
    lexer.unlex(t1)

    return undefined
}

// 55
function signed_int(): BaseType | undefined {
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
function signed_short_int(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_SHORT)
        return { type: Type.TKN_SHORT }
    lexer.unlex(t0)
    return undefined
}

// 57
function signed_long_int(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === Type.TKN_LONG)
        return { type: Type.TKN_LONG }
    lexer.unlex(t0)
    return undefined
}

// 58
function signed_longlong_int(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_LONG) {
        const t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            return { type: Type.SYN_LONGLONG }
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 59
function unsigned_int(): BaseType | undefined {
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
function unsigned_short_int(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        const t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_SHORT) {
            return { type: Type.SYN_UNSIGNED_SHORT }
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 61
function unsigned_long_int(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        const t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            return { type: Type.SYN_UNSIGNED_LONG }
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 62
function unsigned_longlong_int(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_UNSIGNED) {
        const t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_LONG) {
            const t2 = lexer.lex()
            if (t2 !== undefined && t2.type === Type.TKN_LONG) {
                return { type: Type.SYN_UNSIGNED_LONGLONG }
            }
            lexer.unlex(t2)
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 63
function char_type(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_CHAR)
        return { type: Type.TKN_CHAR }
    lexer.unlex(t0)
    return undefined
}

// 64
function wide_char_type(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_WCHAR)
        return { type: Type.TKN_WCHAR }
    lexer.unlex(t0)
    return undefined
}

// 65
function boolean_type(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_BOOLEAN)
        return { type: Type.TKN_BOOLEAN }
    lexer.unlex(t0)
    return undefined
}

// 66
function octet_type(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_OCTET)
        return { type: Type.TKN_OCTET }
    lexer.unlex(t0)
    return undefined
}

// 67
function any_type(): BaseType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_ANY)
        return { type: Type.TKN_ANY }
    lexer.unlex(t0)
    return undefined
}

// 69
function struct_type(): StructDecl | undefined {
    const doc = docBefore()
    const t0 = lexer.lex()
    if (t0 === undefined || t0.type !== Type.TKN_STRUCT) {
        lexer.unlex(t0)
        return undefined
    }
    const t1 = identifier()
    if (t1 === undefined)
        throw Error("expected identifier after 'struct'")
    expect('{')
    const members = member_list()
    if (members === undefined)
        throw Error("expected at least one member within 'struct'")
    expect('}')

    const node: StructDecl = { type: Type.TKN_STRUCT, name: t1.text!, members, doc }
    scoper.addType(node.name, node)

    return node
}

// 70
function member_list(): Member[] | undefined {
    const members: Member[] = []
    while (true) {
        const t1 = member()
        if (t1 === undefined)
            break
        members.push(t1)
    }
    return members.length > 0 ? members : undefined
}

// 71
function member(): Member | undefined {
    const doc = docBefore()
    const t0 = type_spec()
    if (t0 === undefined)
        return undefined
    const names = declarators()
    if (names === undefined)
        throw Error(`expected declarators after type_spec ${describeTypeSpec(t0)}`)
    expect(";")
    return { type: Type.SYN_MEMBER, typeSpec: t0, names, doc }
}

// 72
function union_type(): UnionDecl | undefined {
    const doc = docBefore()
    const t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type !== Type.TKN_UNION) {
        lexer.unlex(t0)
        return undefined
    }

    const t1 = identifier()
    if (t1 === undefined)
        throw Error(`expected identifier after 'union'`)
    const t2 = lexer.lex()
    if (t2 === undefined || t2.type !== Type.TKN_SWITCH) {
        throw Error(`expected 'switch' after union <identifier>`)
    }
    expect("(")
    const switchType = switch_type_spec()
    if (switchType === undefined) {
        throw Error(`expected switch type specifier after union <identifier> switch(`)
    }
    expect(")")
    expect("{")
    const cases = switch_body()
    expect("}")

    const node: UnionDecl = { type: Type.TKN_UNION, name: t1.text!, switchType, cases, doc }
    scoper.addType(node.name, node)

    return node
}

// 73
function switch_type_spec(): TypeSpec | undefined {
    let t0: TypeSpec | undefined = integer_type()
    if (t0 !== undefined)
        return t0
    t0 = char_type()
    if (t0 !== undefined)
        return t0
    t0 = boolean_type()
    if (t0 !== undefined)
        return t0
    t0 = enum_type()
    if (t0 !== undefined)
        return t0
    return scoped_name()
}

// 74
function switch_body(): SwitchCase[] {
    const cases: SwitchCase[] = []
    while (true) {
        const t1 = _case()
        if (t1 === undefined)
            break
        cases.push(t1)
    }
    return cases
}

// 75
function _case(): SwitchCase | undefined {
    const label = case_label()
    if (label === undefined)
        return undefined
    const element = element_spec()
    if (element === undefined)
        throw Error(`expected element specification after '${label.type === Type.TKN_CASE ? "case" : "default"}'`)
    expect(";")
    return { ...label, typeSpec: element.typeSpec, name: element.name }
}

// 76
function case_label(): { type: Type.TKN_CASE, label: Enumerator } | { type: Type.TKN_DEFAULT } | undefined {
    const t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    if (t0.type === Type.TKN_CASE) {
        // TODO: enum only hack, should use const_exp() instead
        const t1 = identifier()
        if (t1 === undefined) {
            throw Error(`expected enum identifier after 'case'`)
        }
        const target = scoper.getType(t1.text!)?.target
        if (target === undefined || target.type !== Type.SYN_ENUMERATOR) {
            throw Error(`unsupported value after 'case'`)
        }
        expect(":")
        return { type: Type.TKN_CASE, label: target }
    }
    if (t0.type === Type.TKN_DEFAULT) {
        expect(":")
        return { type: Type.TKN_DEFAULT }
    }
    lexer.unlex(t0)
    return undefined
}

// 77
function element_spec(): { typeSpec: TypeSpec, name: string } | undefined {
    const t0 = type_spec()
    if (t0 === undefined)
        return undefined
    const t1 = declarator()
    if (t1 === undefined)
        throw Error(`expected declarator after ${describeTypeSpec(t0)}`)
    return { typeSpec: t0, name: t1.text! }
}

// 78
function enum_type(): EnumDecl | undefined {
    const doc = docBefore()
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type == Type.TKN_ENUM) {
        const t1 = identifier()
        if (t1 === undefined)
            throw Error("expected identifier after 'enum'")
        const node: EnumDecl = { type: Type.TKN_ENUM, name: t1.text!, enumerators: [], doc }
        expect("{")
        const usedNames = new Set<string>()
        let t3: Token | undefined
        while (true) {
            const t2 = lexer.lex()
            if (t2 === undefined) {
                throw Error("unexpected end of file")
            }
            if (t2.type !== Type.TKN_IDENTIFIER) {
                if (t3) {
                    throw Error(`expected identifier after ',' but got ${describeToken(t2)})`)
                } else {
                    throw Error(`expected identifier but got ${describeToken(t2)})`)
                }
            }
            if (usedNames.has(t2.text!)) {
                throw Error(`Declaration of enumerator '${t2.text}' clashes with earlier declaration of enumerator '${t2.text}'`)
            }
            usedNames.add(t2.text!)

            const enumerator: Enumerator = { type: Type.SYN_ENUMERATOR, name: t2.text!, enum: node, doc: t2.doc }
            scoper.addType(enumerator.name, enumerator)
            node.enumerators.push(enumerator)

            t3 = lexer.lex()
            if (t3 === undefined)
                throw Error("unexpected end of file")
            if (t3.type !== Type.TKN_TEXT)
                throw Error(`expected ',' or '}' but got ${describeToken(t3)}`)
            if (t3.text === "}")
                break
            if (t3.text !== ",") {
                throw Error(`expected ',' or '}' but got ${describeToken(t3)}`)
            }
        }
        scoper.addType(node.name, node)
        return node
    }
    lexer.unlex(t0)
    return undefined
}

// 80
function sequence_type(): SequenceType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_SEQUENCE) {
        // "sequence" "<" simple_type_spec "," positive_int_const ">"
        expect("<")
        const elementType = simple_type_spec()
        if (elementType === undefined)
            throw Error("expected type after 'sequence <'")
        expect(">")
        return { type: Type.TKN_SEQUENCE, elementType }
    }
    lexer.unlex(t0)
    return undefined
}

// 81
function string_type(): StringType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_STRING) {
        // 'string' '<' <positive_int_const> '>'
        return { type: Type.TKN_STRING }
    }
    lexer.unlex(t0)
    return undefined
}

// 82
function wide_string_type(): StringType | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_WSTRING) {
        // 'wstring' '<' <positive_int_const> '>'
        return { type: Type.TKN_WSTRING }
    }
    lexer.unlex(t0)
    return undefined
}

// 85
function attr_dcl(): Attribute | undefined {
    const doc = docBefore()
    let t0
    t0 = readonly_attr_spec()
    if (t0 === undefined)
        t0 = attr_spec()
    if (t0 !== undefined)
        t0.doc = doc
    return t0
}

// 86
function except_dcl(): ExceptionDecl | undefined {
    const doc = docBefore()
    const t0 = lexer.lex()
    if (t0 === undefined || t0.type != Type.TKN_EXCEPTION) {
        lexer.unlex(t0)
        return undefined
    }
    const t1 = identifier()
    if (t1 === undefined)
        throw Error(`expected identifier after '${describeToken(t0)}'`)

    expect("{")
    const members: Member[] = []
    while (true) {
        const t2 = member()
        if (t2 === undefined)
            break
        members.push(t2)
    }
    expect("}")

    const node: ExceptionDecl = { type: Type.TKN_EXCEPTION, name: t1.text!, members, doc }
    scoper.addType(node.name, node)

    return node
}


// 87 (Operation Declaration)
function op_dcl(): Operation | undefined {
    const doc = docBefore()
    const node_attribute = op_attribute() // opt
    const node_type = op_type_spec()
    if (node_type === undefined) {
        lexer.unlex(node_attribute)
        return undefined
    }
    const node_identifier = identifier()
    if (node_identifier === undefined) {
        throw Error(`expected identifier after '${describeTypeSpec(node_type)}'`)
    }
    const node_parameter_dcls = parameter_dcls()
    if (node_parameter_dcls === undefined) {
        // throw Error("expected parameter declaration after "+t2.toString())
        lexer.unlex(node_identifier)
        // FIXME: missing private or public in valuetype caused this. also: we don't use the private/public declarators yet
        if (node_type.type === Type.SYN_SCOPED_NAME || node_type.type === Type.TKN_SEQUENCE
            || node_type.type === Type.TKN_STRUCT || node_type.type === Type.TKN_UNION || node_type.type === Type.TKN_ENUM) {
            throw Error("expected parameter declaration after " + describeToken(node_identifier))
        }
        lexer.unlex({ type: node_type.type })
        lexer.unlex(node_attribute)
        return undefined
    }
    const raises = raises_expr() ?? []

    return {
        type: Type.SYN_OPERATION_DECLARATION,
        oneway: node_attribute !== undefined,
        returnType: node_type,
        name: node_identifier.text!,
        params: node_parameter_dcls,
        raises,
        doc
    }
}

// 88
function op_attribute(): Token | undefined {
    const t0 = lexer.lex()
    if (!t0)
        return undefined
    if (t0.type !== Type.TKN_ONEWAY) {
        lexer.unlex(t0)
        return undefined
    }
    return t0
}

// 89
function op_type_spec(): TypeSpec | undefined {
    const t0 = param_type_spec()
    if (t0 !== undefined) {
        return t0
    }
    const t1 = lexer.lex()
    if (t1 !== undefined && t1.type === Type.TKN_VOID)
        return { type: Type.TKN_VOID }
    lexer.unlex(t1)
    return undefined
}

// 90
function parameter_dcls(): Parameter[] | undefined {
    const t0 = lexer.lex()
    if (!t0) {
        return undefined
    }
    if (t0.type !== Type.TKN_TEXT || t0.text !== '(') {
        lexer.unlex(t0)
        return undefined
    }

    const declarations: Parameter[] = []
    while (true) {
        const t1 = param_dcl()
        if (t1 !== undefined)
            declarations.push(t1)

        const t2 = lexer.lex()

        if (t2 !== undefined && t2.type === Type.TKN_TEXT && t2.text === ')') {
            break
        }
        if (t2 !== undefined && t2.type === Type.TKN_TEXT && t2.text === ",") {
            continue
        }
        if (t2 !== undefined)
            throw Error("expected 'in', 'out', 'inout' or ')' to end for parameter declaration but got " + describeToken(t2))
        else
            throw Error("expected 'in', 'out', 'inout' or ')' to end for parameter declaration but end of file")
    }
    return declarations
}

// 91
function param_dcl(): Parameter | undefined {
    const doc = docBefore()
    const annotation = annotation_appl()
    const attribute = param_attribute()
    if (attribute === undefined)
        return undefined

    const typeSpec = param_type_spec()
    if (typeSpec === undefined) {
        const t1 = lexer.lex()
        if (t1 !== undefined)
            throw Error("expected type specification but got " + describeToken(t1))
        else
            throw Error("expected type specification but found end of file")
    }

    const t2 = simple_declarator()
    if (t2 === undefined) {
        throw Error("Missing parameter name.")
    }

    if (annotation !== undefined && typeSpec.type === Type.TKN_SEQUENCE) {
        typeSpec.annotation = annotation
    }
    return { type: Type.SYN_PARAMETER_DECLARATION, attribute, typeSpec, name: t2.text!, annotation, doc }
}

// 92
function param_attribute(): Type.TKN_IN | Type.TKN_OUT | Type.TKN_INOUT | undefined {
    const t0 = lexer.lex()
    if (t0 === undefined)
        return undefined
    switch (t0.type) {
        case Type.TKN_IN:
        case Type.TKN_OUT:
        case Type.TKN_INOUT:
            return t0.type
    }
    lexer.unlex(t0)
    return undefined
}

// 93
function raises_expr(): ScopedName[] | undefined {
    const t0 = lexer.lex()
    if (t0 === undefined || t0.type !== Type.TKN_RAISES) {
        lexer.unlex(t0)
        return undefined
    }
    expect("(")
    const raises: ScopedName[] = []
    const t1 = scoped_name()
    if (t1 === undefined)
        throw Error(`expected exception name after 'raises('`)
    if (t1.target.type !== Type.TKN_EXCEPTION)
        throw Error(`expected ${t1.name} to be an exception`)
    raises.push(t1)
    while (true) {
        const t2 = lexer.lex()
        if (t2 === undefined || t2.type !== Type.TKN_TEXT || t2.text !== ",") {
            lexer.unlex(t2)
            break
        }
        const t3 = scoped_name()
        if (t3 === undefined)
            throw Error(`expected exception name after 'raises(..., '`)
        if (t3.target.type !== Type.TKN_EXCEPTION)
            throw Error(`expected ${t3.name} to be an exception`)
        raises.push(t3)
    }
    expect(")")
    return raises
}

// 95
function param_type_spec(): TypeSpec | undefined {
    const annotation = annotation_appl()
    let t0: TypeSpec | undefined = base_type_spec()
    if (t0 === undefined)
        t0 = template_type_spec()	// not in the CORBA specs but MICO does this, usually an typedef would be required for this
    /*
        t0 = string_type()
        if (t0 !== undefined)
            return t0
        t0 = wide_string_type()
        if (t0 !== undefined)
            return t0
    */
    if (t0 === undefined)
        t0 = scoped_name()

    if (t0 !== undefined && annotation !== undefined && t0.type === Type.TKN_SEQUENCE) {
        t0.annotation = annotation
    }
    return t0
}

// 104
function readonly_attr_spec(): Attribute | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_READONLY) {
        const t1 = lexer.lex()
        if (t1 !== undefined && t1.type === Type.TKN_ATTRIBUTE) {
            const typeSpec = param_type_spec()
            if (typeSpec === undefined)
                throw Error("expected type specifier after 'readonly attribute'")
            const names = declarators()
            if (names === undefined)
                throw Error("expected declarator for 'readonly attribute'")
            return { type: Type.TKN_ATTRIBUTE, readonly: true, typeSpec, names }
        }
        lexer.unlex(t1)
    }
    lexer.unlex(t0)
    return undefined
}

// 106
function attr_spec(): Attribute | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_ATTRIBUTE) {
        const typeSpec = param_type_spec()
        if (typeSpec === undefined)
            throw Error("expected type specifier after 'attribute'")
        const names = declarators()
        if (names === undefined)
            throw Error("expected declarator for 'attribute'")
        return { type: Type.TKN_ATTRIBUTE, readonly: false, typeSpec, names }
    }
    lexer.unlex(t0)
    return undefined
}

// IDL 4, 7.4.15 Building Block Annotations

// 209
function annotation_appl(): Annotation | undefined {
    // @ scoped_name [ ]
    const t0 = lexer.lex()
    if (t0?.text !== "@") {
        lexer.unlex(t0)
        return undefined
    }
    const t1 = identifier() // should've been scoped_name but that doesn't work here
    if (t1 === undefined) {
        throw Error("expeced identifier after @")
    }
    expect("(")
    const params = annotation_appl_params()
    expect(")")
    return { type: Type.SYN_ANNOTAION, name: t1.text!, params }
}

// 210
function annotation_appl_params(): Array<{ name: string, value: string }> {
    const params: Array<{ name: string, value: string }> = []
    while (true) {
        params.push(annotation_appl_param())
        const t1 = lexer.lex()
        if (t1?.text !== ',') {
            lexer.unlex(t1)
            break
        }
    }
    return params
}

// 211
function annotation_appl_param(): { name: string, value: string } {
    const id = identifier()
    if (id === undefined) {
        throw Error(`expected identifier`)
    }
    expect("=")
    const val = identifier()
    if (val === undefined) {
        throw Error(`expected value`)
    }
    return { name: id.text!, value: val.text! }
}

// the documentation comment in front of the next token, the token itself stays in the stream
function docBefore(): string[] | undefined {
    const t = lexer.lex()
    lexer.unlex(t)
    return t?.doc
}

function identifier(): Token | undefined {
    const t0 = lexer.lex()
    if (t0 !== undefined && t0.type === Type.TKN_IDENTIFIER) {
        return t0
    }
    lexer.unlex(t0)
    return undefined
}

function describeTypeSpec(typeSpec: TypeSpec): string {
    if (typeSpec.type === Type.SYN_SCOPED_NAME)
        return `identifier '${typeSpec.name}'`
    return describeToken({ type: typeSpec.type })
}

function resolve_module_separator(name: string): void {
    const paamayimNekudotayim = lexer.lex()
    if (paamayimNekudotayim === undefined || paamayimNekudotayim.type !== Type.TKN_COLON_COLON)
        throw Error(`Expected :: after module identifier '${name}'`)
}

function find_in_module(module: ModuleDecl, name: string): Declaration | undefined {
    for (const child of module.definitions) {
        switch (child.type) {
            case Type.TKN_MODULE:
            case Type.TKN_NATIVE:
            case Type.TKN_VALUETYPE:
            case Type.SYN_INTERFACE:
            case Type.TKN_STRUCT:
            case Type.TKN_UNION:
            case Type.TKN_ENUM:
            case Type.TKN_EXCEPTION:
                if (child.name === name)
                    return child
                break
            case Type.TKN_TYPEDEF:
                // like type_dcl(): a typedef name refers to the aliased type
                if (child.names.includes(name))
                    return child.typeSpec
                break
        }
    }
    return undefined
}

// corba.js maps 'native Foo_ptr' declared in the global scope to the type 'Foo'
function resolve_native_ptr(native: NativeDecl, scope: ModuleDecl | undefined): void {
    if (scope !== undefined || native.ptrTarget !== undefined)
        return
    if (native.name.length <= 4 || native.name.substring(native.name.length - 4) !== "_ptr")
        return
    const stem = native.name.substring(0, native.name.length - 4)
    const referenced = scoper.getType(stem)
    if (referenced === undefined || referenced.target.type === Type.SYN_ENUMERATOR)
        return
    native.ptrTarget = makeScopedName(stem, [], referenced)
}

function makeScopedName(name: string, path: ModuleDecl[], entry: Entry): ScopedName {
    if (entry.target.type === Type.SYN_ENUMERATOR)
        throw Error(`enumerator '${name}' can not be used as a type`)
    return { type: Type.SYN_SCOPED_NAME, name, path, scope: entry.scope, target: entry.target }
}

function expect(text: string, customMessage?: string): void {
    const t0 = lexer.lex()
    let errorMessage
    if (customMessage === undefined) {
        errorMessage = `expected '${text}' but got '${describeToken(t0)}'`
    } else {
        errorMessage = customMessage
    }

    if (t0 === undefined) {
        throw Error(errorMessage + " but found end of file")
    }
    if (t0.type !== Type.TKN_TEXT || t0.text !== text) {
        throw Error(errorMessage)
    }
}

// a declared name: what it refers to and the scope it was declared in
type Entry = {
    target: Declaration | Enumerator
    scope: ModuleDecl | undefined
}

class Scope {
    node: ModuleDecl | undefined
    types: Map<string, Entry>
    constructor(node: ModuleDecl | undefined) {
        this.node = node
        this.types = new Map<string, Entry>()
    }
    addType(name: string, target: Declaration | Enumerator): void {
        if (this.types.has(name))
            throw Error("duplicate typename '" + name + "'")
        this.types.set(name, { target, scope: this.node })
    }
    getType(name: string): Entry | undefined {
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
    addType(name: string, type: Declaration | Enumerator): void {
        this.getCurrentScope().addType(name, type)
    }
    getType(name: string): Entry | undefined {
        for (let i = this.stack.length - 1; i >= 0; --i) {
            const type = this.stack[i].getType(name)
            if (type !== undefined)
                return type
        }
        return undefined
    }
    enterModule(node: ModuleDecl) {
        this.getCurrentScope().addType(node.name, node)
        this.stack.push(new Scope(node))
    }
    leaveModule() {
        this.stack.pop()
    }
}
