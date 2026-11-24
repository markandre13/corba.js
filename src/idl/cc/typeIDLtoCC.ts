import { Type, Declaration, ModuleDecl } from "../idl-node"

export enum Direction {
    /** 
     * data is to be passed from IIOP to application
     *
     * corba.cc will sometimes use std::span instead of std::vector and std::string_view
     * instead of std::string to avoid copying data
     */
    IN,
    /** data is to be passed from application to IIOP */
    OUT,
    /**
     * data is passed a part of a sequence
     */
    NESTED = OUT
}

// the type that determines the C++ mapping, a scoped name stands for the declaration it refers to
export function resolvedType(type: Declaration): Type {
    return type.type === Type.SYN_SCOPED_NAME ? resolvedType(type.target) : type.type
}

// the name a declaration has in IDL, aliased types like sequences have none
export function declarationName(declaration: Declaration): string {
    if (declaration.type === Type.SYN_SCOPED_NAME) return declarationName(declaration.target)
    return "name" in declaration ? declaration.name : ""
}

// this about how to encode the type
export function typeIDLtoCC(type: Declaration, direction: Direction): string {
    switch (type.type) {
        case Type.SYN_SCOPED_NAME:
            {
                const identifierType = type.target
                let relativeName = [...type.path.map(x => x.name), declarationName(identifierType)].join("::")

                let absolutePrefix = ""
                for (let x: ModuleDecl | undefined = type.path.length > 0 ? type.path[0]!.parent : type.scope; x; x = x.parent) {
                    absolutePrefix = `::${x.name}${absolutePrefix}`
                }

                if (
                    type.path.length === 0 &&
                    resolvedType(identifierType) === Type.TKN_NATIVE &&
                    type.name.length > 4 &&
                    type.name.substring(type.name.length - 4) === "_ptr"
                ) {
                    const ptrName = type.name.substring(0, type.name.length - 4)
                    return `${absolutePrefix.length == 0 ? ptrName : `${absolutePrefix.substring(2)}::${ptrName}`} | undefined`
                }

                let name: string
                switch (identifierType.type) {
                    case Type.TKN_VALUETYPE:
                        throw Error("not implemented yet")
                        // if (filetype !== FileType.VALUETYPE && filetype !== FileType.VALUE)
                        //     name = `valuetype${absolutePrefix}.${relativeName}`
                        // else
                        //     name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(2)}::${relativeName}`
                        break
                    case Type.SYN_INTERFACE:
                        // throw Error("not implemented yet")
                        // if (filetype !== FileType.INTERFACE)
                        //     name = `_interface${absolutePrefix}.${relativeName}`
                        // else
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(2)}::${relativeName}`
                        name = `std::shared_ptr<${name}>`
                        break
                    case Type.TKN_ENUM:
                    case Type.TKN_UNION:
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(2)}::${relativeName}`
                        break
                    case Type.TKN_STRUCT:
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(2)}::${relativeName}`
                        if (direction == Direction.IN) {
                            name = `const ${name}&`
                        }
                        break
                    case Type.TKN_NATIVE:
                        name =
                            absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(2)}::${relativeName}`
                        break
                    case Type.TKN_SEQUENCE:
                        name = typeIDLtoCC(identifierType, direction)
                        break
                    default:
                        // a typedef of a predefined type, or of another name: map the aliased type
                        return typeIDLtoCC(identifierType, direction)
                }
                return name
            }
            break
        case Type.TKN_VOID:
            return "void"
        case Type.TKN_BOOLEAN:
            return "bool"
        case Type.TKN_CHAR:
            return "char"
        case Type.TKN_OCTET:
            return "uint8_t"
        case Type.TKN_SHORT:
            return "int16_t"
        case Type.TKN_LONG:
            return "int32_t"
        case Type.SYN_LONGLONG:
            return "int64_t"
        case Type.SYN_UNSIGNED_SHORT:
            return "uint16_t"
        case Type.SYN_UNSIGNED_LONG:
            return "uint32_t"
        case Type.SYN_UNSIGNED_LONGLONG:
            return "uint64_t"
        case Type.TKN_FLOAT:
            return "float"
        case Type.TKN_DOUBLE:
            return "double"
        case Type.SYN_LONG_DOUBLE:
            return "long double"
        case Type.TKN_STRING:
            switch (direction) {
                case Direction.IN:
                    return "const std::string_view &"
                case Direction.OUT:
                    return "std::string"
                default:
                    throw Error("yikes")
            }
        case Type.TKN_SEQUENCE:
            switch(resolvedType(type.elementType)) {
                case Type.TKN_OCTET:
                    switch (direction) {
                        case Direction.IN:
                            return "const CORBA::blob_view &"
                        case Direction.OUT:
                            return "CORBA::blob"
                        default:
                            throw Error("yikes")
                    }
                case Type.TKN_STRING:
                    // virtual CORBA::async<void> callSeqString(const std::vector<std::string_view> & value) = 0;
                    switch (direction) {
                        case Direction.IN:
                            // return `const std::vector<${typeIDLtoCC(type.elementType, direction)}> &`
                            return `const std::vector<std::string_view> &`
                        case Direction.OUT:
                            return `std::vector<${typeIDLtoCC(type.elementType, direction)}>`
                        default:
                            throw Error("yikes")
                    }
                case Type.TKN_FLOAT:
                case Type.TKN_DOUBLE:
                    switch (direction) {
                        case Direction.IN:
                            return `const std::span<${typeIDLtoCC(type.elementType, direction)}> &`
                        case Direction.OUT:
                            return `std::vector<${typeIDLtoCC(type.elementType, direction)}>`
                        default:
                            throw Error("yikes")
                    }
                default:
                    switch (direction) {
                        case Direction.IN:
                            return `const std::vector<${typeIDLtoCC(type.elementType, Direction.NESTED)}> &`
                        case Direction.OUT:
                            return `std::vector<${typeIDLtoCC(type.elementType, Direction.NESTED)}>`
                        default:
                            throw Error("yikes")
                    }
            }
        default:
            throw Error(`no mapping from IDL type to C++ type for ${Type[type.type]}`)
    }
}
