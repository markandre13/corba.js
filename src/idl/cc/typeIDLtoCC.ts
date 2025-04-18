import { Type, Node } from "../idl-node"

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
                        // throw Error("not implemented yet")
                        // if (filetype !== FileType.INTERFACE)
                        //     name = `_interface${absolutePrefix}.${relativeName}`
                        // else
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                        name = `std::shared_ptr<${name}>`
                        break
                    case Type.TKN_ENUM:
                    case Type.TKN_UNION:
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                        break
                    case Type.TKN_STRUCT:
                        name = absolutePrefix.length == 0 ? relativeName : `${absolutePrefix.substring(1)}.${relativeName}`
                        if (direction == Direction.IN) {
                            name = `const ${name}&`
                        }
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
            switch(type?.child[0]?.type) {
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
                            // return `const std::vector<${typeIDLtoCC(type!.child[0], direction)}> &`
                            return `const std::vector<std::string_view> &`
                        case Direction.OUT:
                            return `std::vector<${typeIDLtoCC(type!.child[0], direction)}>`
                        default:
                            throw Error("yikes")
                    }
                case Type.TKN_FLOAT:
                case Type.TKN_DOUBLE:
                    switch (direction) {
                        case Direction.IN:
                            return `const std::span<${typeIDLtoCC(type!.child[0], direction)}> &`
                        case Direction.OUT:
                            return `std::vector<${typeIDLtoCC(type!.child[0], direction)}>`
                        default:
                            throw Error("yikes")
                    }
                default:
                    switch (direction) {
                        case Direction.IN:
                            return `const std::vector<${typeIDLtoCC(type!.child[0], Direction.NESTED)}> &`
                        case Direction.OUT:
                            return `std::vector<${typeIDLtoCC(type!.child[0], Direction.NESTED)}>`
                        default:
                            throw Error("yikes")
                    }
            }
        default:
            throw Error(`no mapping from IDL type to C++ type for ${type.toString()}`)
    }
}
