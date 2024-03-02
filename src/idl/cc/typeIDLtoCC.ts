import { Type, Node } from "../idl-node"

export enum Direction {
    IN,
    OUT,
}

// this about how to encode the type
export function typeIDLtoCC(type: Node | undefined, direction: Direction): string {
    if (type === undefined) throw Error("internal error: parser delivered no type information")
    switch (type!.type) {
        case Type.TKN_IDENTIFIER:
            {
                let identifierType = type.child[type.child.length - 1]!
                let relativeName = ""
                for (let x of type.child) {
                    relativeName = `${relativeName}.${x!.text!}`
                }
                relativeName = relativeName.substring(1)

                let absolutePrefix = ""
                for (let x: Node | undefined = type.child[0]?.typeParent; x; x = x.typeParent) {
                    absolutePrefix = `.${x!.text}${absolutePrefix}`
                }

                if (
                    type.child.length > 0 &&
                    type.child[0]!.type === Type.TKN_NATIVE &&
                    type.text!.length > 4 &&
                    type.text!.substring(type.text!.length - 4) === "_ptr"
                ) {
                    return `${absolutePrefix.substring(1)} | undefined`
                }

                let name: string
                switch (identifierType.type) {
                    case Type.TKN_VALUETYPE:
                        throw Error("not implemented yet")
                        // if (filetype !== FileType.VALUETYPE && filetype !== FileType.VALUE)
                        //     name = `valuetype${absolutePrefix}.${relativeName}`
                        // else
                        //     name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                        break
                    case Type.SYN_INTERFACE:
                    case Type.TKN_ENUM:
                    case Type.TKN_UNION:
                        // throw Error("not implemented yet")
                        // if (filetype !== FileType.INTERFACE)
                        //     name = `_interface${absolutePrefix}.${relativeName}`
                        // else
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                        name = `std::shared_ptr<${name}>`
                        break
                    case Type.TKN_STRUCT:
                        throw Error("not implemented yet")
                        // FIXME: struct uses a wrong identifier node structure
                        // name = type!.text!
                        // if (filetype !== FileType.INTERFACE)
                        //     name = `_interface${absolutePrefix}.${name}`
                        break
                    case Type.TKN_NATIVE:
                        name =
                            absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                        break
                    case Type.TKN_SEQUENCE:
                        name = typeIDLtoCC(type.child[0], direction)
                        break
                    default:
                        throw Error(
                            `Internal Error in typeIDLtoCC(): type ${identifierType.toString()} is not implemented`
                        )
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
            if (type?.child[0]?.type === Type.TKN_OCTET) {
                switch (direction) {
                    case Direction.IN:
                        return "const CORBA::blob_view &"
                    case Direction.OUT:
                        return "CORBA::blob"
                    default:
                        throw Error("yikes")
                }
            }
            return `std::vector<${typeIDLtoCC(type!.child[0], direction)}>`
        default:
            throw Error(`no mapping from IDL type to C++ type for ${type.toString()}`)
    }
}
