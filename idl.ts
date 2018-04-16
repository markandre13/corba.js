import * as fs from "fs"

enum TokenType {
    NONE,
    CHAR,
    IDENTIFIER,
    IN,
    OUT,
    VOID,
    STRING,
    NUMBER,
    BOOLEAN,
    MODULE,
    INTERFACE,
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
            case TokenType.NONE:
                return "none"
            case TokenType.CHAR:
                return "char '"+this.text+"'"
            case TokenType.IDENTIFIER:
                return "identifier '"+this.text+"'"
            case TokenType.IN:
                return "in"
            case TokenType.OUT:
                return "out"
            case TokenType.VOID:
                return "void"
            case TokenType.STRING:
                return "string"
            case TokenType.NUMBER:
                return "number"
            case TokenType.BOOLEAN:
                return "boolean"
            case TokenType.INTERFACE:
                return "interface"
        }
    }
}

class Lexer {
    data: string
    pos: number
    state: number
    text: string
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
        this.pos = 0
        this.state = 0
        this.tokenStack = new Array<Token>()
    }
    
    eof(): boolean {
        return this.pos >= this.data.length
    }
    
    getc(): string {
        return this.data[this.pos++]
    }
    
    unput(): void {
        --this.pos
    }
    
    unlex(token: Token): void {
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
                        case '_':
                            this.state = 1
                            this.text = ""
                            continue
                        default:
                            if (Lexer.isAlpha(c)) {
                                this.state = 2
                            } else {
                                return new Token(TokenType.CHAR, c)
                            }
                            break
                    }
                    break
                case 1:
                    if (!Lexer.isAlpha(c)) {
                        this.unput()
                        this.state = 0
                        return new Token(TokenType.IDENTIFIER, this.text)
                    }
                    break
                case 2:
                    if (!Lexer.isAlpha(c)) {
                        this.unput()
                        this.state = 0
                        switch(this.text) {
                            case "module":
                                return new Token(TokenType.MODULE)
                            case "interface":
                                return new Token(TokenType.INTERFACE)
                            case "in":
                                return new Token(TokenType.IN)
                            case "out":
                                return new Token(TokenType.OUT)
                            case "void":
                                return new Token(TokenType.VOID)
                            case "number":
                                return new Token(TokenType.NUMBER)
                            case "string":
                                return new Token(TokenType.STRING)
                            case "boolean":
                                return new Token(TokenType.BOOLEAN)
                            default:
                                return new Token(TokenType.IDENTIFIER, this.text)
                        }
                    }
                    break
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

while(true) {
    let token = lexer.lex()
    if (token === undefined)
        break
    console.log(token.toString())
}

console.log("done")
