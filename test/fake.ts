import * as fs from "fs"
import { Socket } from "net"
import { ORB } from "corba.js"
import { Protocol } from "corba.js/orb/protocol"
import { Connection } from "corba.js/orb/connection"
import { TcpProtocol } from "corba.js/net/socket"

const InitialInitiatorRequestIdBiDirectionalIIOP = 0
const InitialResponderRequestIdBiDirectionalIIOP = 1

enum Mode {
    OFF,
    RECORD,
    REPLAY
}

// https://martinfowler.com/bliki/SelfInitializingFake.html
export class FakeTcpProtocol implements Protocol {
    orb!: ORB
    tcp = new TcpProtocol()
    socket!: Socket
    verbose = true

    testName?: string
    mode = Mode.OFF
    fd: number = -1;
    buffer: string[] = []

    async connect(orb: ORB, hostname: string, port: number) {
        return new Promise<Connection>((resolve, reject) => {
            const socket = new Socket()
            socket.setNoDelay()
            socket.once("error", (error: Error) => reject(error))
            socket.connect(port, hostname, () => {
                const connection = new TcpFakeConnection(this, socket, orb)
                connection.requestId = InitialInitiatorRequestIdBiDirectionalIIOP
                // clear error handler?
                socket.on("error", (error: Error) => orb.socketError(connection, error))
                socket.on("close", (hadError: boolean) => orb.socketClosed(connection))
                socket.on("data", (data: Buffer) => {
                    if (this.mode === Mode.RECORD) {
                        const view = new Uint8Array(data)
                        if (this.testName) {
                            const dump = `IN ${connection.localAddress}:${connection.localPort} <- ${connection.remoteAddress}:${connection.remotePort}\n${this.toHexdump(view)}`
                            if (this.fd !== -1) {
                                fs.writeSync(this.fd, dump)
                            }
                            if (this.verbose) {
                                console.log(dump)
                            }
                        }
                    }
                    orb.socketRcvd(connection, data.buffer)
                })
                orb.addConnection(connection)
                resolve(connection)
            })
        })
    }

    reset() {
        this.mode = Mode.OFF
        this.testName = undefined
        if (this.fd !== -1) {
            fs.closeSync(this.fd)
            this.fd = -1
        }
    }

    record() {
        this.mode = Mode.RECORD
    }

    replay() {
        this.mode = Mode.REPLAY
    }

    // replay(orb: ORB) {
    //     this.orb = orb
    //     orb.socketSend = (buffer: ArrayBuffer) => {
    //         if (this.testName === undefined) {
    //             throw Error(`Fake is in replay mode but no expectation has been set up.`)
    //         }
    //         const view = new Uint8Array(buffer)
    //         let line = this.buffer.shift()
    //         if (line !== "OUT") {
    //             throw Error(`Expected OUT but got '${line}'`)
    //         }
    //         const data = this.fromHexdump()
    //         if (data.compare(view) !== 0) {
    //             console.log("EXPECTED")
    //             console.log(this.toHexdump(data))
    //             console.log("GOT")
    //             console.log(this.toHexdump(view))
    //             throw Error(`Output does not match expectation.`)
    //         }
    //         this.handleIn()
    //     }
    // }

    expect(name: string) {
        if (this.testName !== undefined) {
            throw Error("test fake setup error: missing reset() call. try to add this to you test: beforeEach(function() { fake.reset() })")
        }
        this.testName = `test/giop/${name.replace(/\W/g, "-")}.dump`
        switch (this.mode) {
            case Mode.RECORD:
                this.fd = fs.openSync(this.testName, "w+")
                break
            case Mode.REPLAY:
                this.buffer = fs.readFileSync(this.testName!).toString("ascii").split(/\r?\n/)
                break
        }
        // console.log(`EXPECT ${name} (${this.testName})`)
    }

    public toHexdump(bytes: Uint8Array, addr = 0, length = bytes.byteLength) {
        let result = ""
        while (addr < length) {
            let line = addr.toString(16).padStart(4, "0")
            for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j)
                line += " " + bytes[j].toString(16).padStart(2, "0")
            line = line.padEnd(4 + 16 * 3 + 1, " ")
            for (let i = 0, j = addr; i < 16 && j < bytes.byteLength; ++i, ++j) {
                const b = bytes[j]
                if (b >= 32 && b < 127)
                    line += String.fromCharCode(b)

                else
                    line += "."
            }
            addr += 16
            result += line + "\n"
        }
        return result
    }

    public fromHexdump() {
        const x: number[] = []
        while (true) {
            const line = this.buffer.shift()
            if (line === undefined)
                break
            if (line.length < 4) {
                this.buffer.unshift(line)
                break
            }
            for (let i = 0; i < 16; ++i) {
                const offset = 5 + i * 3
                const byte = parseInt(line.substring(offset, offset + 2), 16)
                if (Number.isNaN(byte))
                    break
                x.push(byte)
            }
        }
        return Buffer.from(x)
    }
}

class TcpFakeConnection extends Connection {
    private socket: Socket
    private fake: FakeTcpProtocol

    constructor(fake: FakeTcpProtocol, socket: Socket, orb: ORB) {
        super(orb)
        this.fake = fake
        this.socket = socket
    }

    get localAddress(): string {
        return this.socket.localAddress
    }
    get localPort(): number {
        return this.socket.localPort
    }
    get remoteAddress(): string {
        return this.socket.remoteAddress!
    }
    get remotePort(): number {
        return this.socket.remotePort!
    }

    close() {
        this.socket.destroy()
    }

    send(buffer: ArrayBuffer): void {
        const view = new Uint8Array(buffer)
        switch (this.fake.mode) {
            case Mode.RECORD:            
                this.recordOut(view)
                break
            case Mode.REPLAY:
                if (this.fake.testName === undefined) {
                    throw Error(`Fake is in replay mode but no expectation has been set up.`)
                }
                this.handleOut(view)
                this.handleIn()
                break

            case Mode.OFF:
                this.socket.write(view)
        }
    }

    recordOut(view: Uint8Array) {
        const dump = `OUT ${this.localAddress}:${this.localPort} -> ${this.remoteAddress}:${this.remotePort}\n${this.fake.toHexdump(view)}`
        if (this.fake.fd !== -1) {
            fs.writeSync(this.fake.fd, dump)
        }
        if (this.fake.verbose) {
            console.log(dump)
        }
        this.socket.write(view)
    }

    handleOut(view: Uint8Array) {
        let line = this.fake.buffer.shift()
        if (line !== "OUT") {
            throw Error(`Expected OUT but got '${line}'`)
        }
        const data = this.fake.fromHexdump()
        if (data.compare(view) !== 0) {
            console.log("EXPECTED")
            console.log(this.fake.toHexdump(data))
            console.log("GOT")
            console.log(this.fake.toHexdump(view))
            throw Error(`Output does not match expectation.`)
        }
    }

    protected handleIn() {
        let line = this.fake.buffer.shift()
        if (line === "IN") {
            setTimeout(() => {
                const data = this.fake.fromHexdump()
                const b2 = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
                // this.orb.socketRcvd(b2)
                this.handleIn()
            }, 0)
        } else {
            if (line !== undefined) {
                this.fake.buffer.unshift(line)
            }
        }
    }
}
