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

    // typed syntax tree nodes (see the interfaces below)
    SYN_SPECIFICATION,
    SYN_INTERFACE,
    SYN_OPERATION_DECLARATION,
    SYN_STATE_MEMBER,
    SYN_MEMBER,
    SYN_PARAMETER_DECLARATION,
    SYN_ANNOTAION,
    SYN_SCOPED_NAME,
    SYN_ENUMERATOR,

    // synthetic tokens combining other tokens
    SYN_LONGLONG,
    SYN_UNSIGNED_SHORT,
    SYN_UNSIGNED_LONG,
    SYN_UNSIGNED_LONGLONG,
    SYN_LONG_DOUBLE
}

// A token as delivered by the lexer. The parser turns tokens into the typed nodes below
// and never hands a Token to the code generators.
export interface Token {
    type: Type
    text?: string
    // the documentation comment lines directly before this token
    doc?: string[]
}

export type Annotation = {
    type: Type.SYN_ANNOTAION
    name: string
    params: Array<{ name: string, value: string }>
}

// predefined types, including 'void' as a return type
export type BaseType = {
    type: Type.TKN_FLOAT | Type.TKN_DOUBLE | Type.SYN_LONG_DOUBLE
        | Type.TKN_SHORT | Type.TKN_LONG | Type.SYN_LONGLONG
        | Type.SYN_UNSIGNED_SHORT | Type.SYN_UNSIGNED_LONG | Type.SYN_UNSIGNED_LONGLONG
        | Type.TKN_CHAR | Type.TKN_WCHAR | Type.TKN_BOOLEAN | Type.TKN_OCTET | Type.TKN_ANY | Type.TKN_VOID
}

export type StringType = {
    type: Type.TKN_STRING | Type.TKN_WSTRING
}

export type SequenceType = {
    type: Type.TKN_SEQUENCE
    elementType: TypeSpec
    annotation?: Annotation
}

// A reference to a declaration by name, e.g. `Foo` or `Mod::Foo`.
// target is the declaration the name resolves to. For typedefs this is the
// aliased type, not the typedef itself.
export type ScopedName = {
    type: Type.SYN_SCOPED_NAME
    name: string
    // the module chain written before the last name component, outermost first
    path: ModuleDecl[]
    // the scope in which target was declared, undefined for the global scope
    scope: ModuleDecl | undefined
    target: Declaration
}

export type TypeSpec =
    | BaseType
    | StringType
    | SequenceType
    | ScopedName
    | StructDecl
    | UnionDecl
    | EnumDecl

export type Declaration =
    | TypeSpec
    | ModuleDecl
    | InterfaceDecl
    | ValueTypeDecl
    | NativeDecl
    | ExceptionDecl

// struct, exception and the members of both
export type Member = {
    type: Type.SYN_MEMBER
    typeSpec: TypeSpec
    names: string[]
}

export type StructDecl = {
    type: Type.TKN_STRUCT
    name: string
    members: Member[]
    doc?: string[]
}

export type ExceptionDecl = {
    type: Type.TKN_EXCEPTION
    name: string
    members: Member[]
    doc?: string[]
}

export type Enumerator = {
    type: Type.SYN_ENUMERATOR
    name: string
    enum: EnumDecl
}

export type EnumDecl = {
    type: Type.TKN_ENUM
    name: string
    enumerators: Enumerator[]
    doc?: string[]
}

export type SwitchCase = {
    type: Type.TKN_CASE
    label: Enumerator
    typeSpec: TypeSpec
    name: string
} | {
    type: Type.TKN_DEFAULT
    typeSpec: TypeSpec
    name: string
}

export type UnionDecl = {
    type: Type.TKN_UNION
    name: string
    switchType: TypeSpec
    cases: SwitchCase[]
    doc?: string[]
}

export type TypedefDecl = {
    type: Type.TKN_TYPEDEF
    typeSpec: TypeSpec
    names: string[]
}

export type NativeDecl = {
    type: Type.TKN_NATIVE
    name: string
    // for 'native Foo_ptr' declared in the global scope: the type 'Foo' it refers to, if known
    ptrTarget?: ScopedName
}

export type ModuleDecl = {
    type: Type.TKN_MODULE
    name: string
    parent: ModuleDecl | undefined
    definitions: Definition[]
}

export type InterfaceDecl = {
    type: Type.SYN_INTERFACE
    name: string
    modifier?: Type.TKN_ABSTRACT | Type.TKN_LOCAL
    base?: ScopedName
    body: Export[]
    doc?: string[]
}

export type ValueTypeDecl = {
    type: Type.TKN_VALUETYPE
    name: string
    base: ScopedName[]
    elements: Array<Export | StateMember>
    doc?: string[]
}

export type Operation = {
    type: Type.SYN_OPERATION_DECLARATION
    oneway: boolean
    returnType: TypeSpec
    name: string
    params: Parameter[]
    raises: ScopedName[]
    doc?: string[]
}

export type Attribute = {
    type: Type.TKN_ATTRIBUTE
    readonly: boolean
    typeSpec: TypeSpec
    names: string[]
    doc?: string[]
}

export type StateMember = {
    type: Type.SYN_STATE_MEMBER
    visibility: Type.TKN_PUBLIC | Type.TKN_PRIVATE
    typeSpec: TypeSpec
    names: string[]
    doc?: string[]
}

export type Parameter = {
    type: Type.SYN_PARAMETER_DECLARATION
    attribute: Type.TKN_IN | Type.TKN_OUT | Type.TKN_INOUT
    typeSpec: TypeSpec
    name: string
    annotation?: Annotation
    doc?: string[]
}

export type Export = Operation | Attribute

export type Definition =
    | ModuleDecl
    | InterfaceDecl
    | ValueTypeDecl
    | TypedefDecl
    | StructDecl
    | UnionDecl
    | EnumDecl
    | NativeDecl
    | ExceptionDecl

export type Specification = {
    type: Type.SYN_SPECIFICATION
    definitions: Definition[]
}
