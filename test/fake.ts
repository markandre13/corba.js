import * as fs from "fs"
import { Socket } from "net"
import { ORB } from "corba.js"
import { Protocol } from "corba.js/orb/protocol"
import { Connection } from "corba.js/orb/connection"
import { TcpProtocol } from "corba.js/net/tcp"

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
    tcp = new TcpProtocol() // cruft ???
    socket!: Socket
    verbose = false

    testName?: string

    mode = Mode.OFF
    fd: number = -1; // out
    buffer: string[] = [] // in

    async connect(orb: ORB, hostname: string, port: number) {
        this.orb = orb
        if (this.mode === Mode.REPLAY && this.testName && this.fd) {
            const connection = new TcpFakeConnection(this, undefined, orb)
            if (this.verbose) {
                console.log(`FAKE: connect ${hostname}:${port}, got ${connection.localAddress}:${connection.localPort} to ${connection.remoteAddress}:${connection.remotePort}`)
            }
            return connection
        }

        return new Promise<Connection>((resolve, reject) => {
            const socket = new Socket()
            socket.setNoDelay()
            socket.once("error", (error: Error) => reject(error))
            socket.connect(port, hostname, () => {
                // FIXME: track the remote peers local port while recording and use it during replace
                // for now: just write the port into a file with a fixed name, as we only have one fake for now
                const connection = new TcpFakeConnection(this, socket, orb)
                connection.requestId = InitialInitiatorRequestIdBiDirectionalIIOP
                // clear error handler?
                socket.on("error", (error: Error) => orb.socketError(connection, error))
                socket.on("close", (hadError: boolean) => orb.socketClosed(connection))
                socket.on("data", (data: Buffer) => {
                    if (this.mode === Mode.RECORD) {
                        const view = new Uint8Array(data)
                        if (this.testName) {
                            const dump = `IN\n${this.toHexdump(view)}`
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

    async close() {}

    async reset() {
        if (this.verbose) {
            console.log(`FAKE: RESET`)
        }
        this.testName = undefined
        if (this.fd !== -1) {
            fs.closeSync(this.fd)
            this.fd = -1
        }
        this.buffer = []
        // this get's stuck...
        // await this.orb.replaceAllConnections()
    }

    off() {
        if (this.verbose) {
            console.log(`FAKE: OFF`)
        }
        this.mode = Mode.OFF
    }

    record() {
        if (this.verbose) {
            console.log(`FAKE: RECORD`)
        }
        this.mode = Mode.RECORD
    }

    replay() {
        if (this.verbose) {
            console.log(`FAKE: REPLACE`)
        }
        this.mode = Mode.REPLAY
    }

    expect(name: string) {
        if (this.verbose) {
            console.log(`FAKE: EXPECT ${name}`)
        }
        if (this.testName !== undefined) {
            throw Error("test fake setup error: missing reset() call. try to add this to you test: beforeEach(function() { fake.reset() })")
        }
        this.testName = `test/giop/${name.replace(/\W/g, "-")}.dump`
        switch (this.mode) {
            case Mode.RECORD:
                this.fd = fs.openSync(this.testName, "w+")
                break
            case Mode.REPLAY:
                if (this.verbose) {
                    console.log(`FAKE: load '${this.testName}'`)
                }
                this.buffer = fs.readFileSync(this.testName!).toString("ascii").split(/\r?\n/).map( l => l.trim())
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
            if (line.charCodeAt(0) < 0x30 || 0x39 < line.charCodeAt(0)) {
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
    private socket?: Socket
    private fake: FakeTcpProtocol

    private _localAddress: string
    private _localPort: number
    private _remoteAddress: string
    private _remotePort: number

    constructor(fake: FakeTcpProtocol, socket: Socket | undefined, orb: ORB) {
        super(orb)
        this.fake = fake
        this.socket = socket

        if (socket) {
            this._localAddress = socket.localAddress!
            this._localPort = socket.localPort!
            this._remoteAddress = socket.remoteAddress!
            this._remotePort = socket.remotePort!
            if (this.fake.mode === Mode.RECORD && this.fake.testName !== undefined) {
                fs.writeSync(this.fake.fd, `CONNECT ${this.localAddress} ${this.localPort} ${this.remoteAddress} ${this.remotePort}\n`)
            }
        } else {
            if (this.fake.mode !== Mode.REPLAY || this.fake.testName === undefined) {
                throw Error("yikes")
            }
            let line = this.fake.buffer.shift()
            if (!line?.startsWith("CONNECT ")) {
                throw Error(`missing CONNECT in ${this.fake.testName}, got: ${line}`)
            }
            let x = line.split(" ")
            this._localAddress = x[1]
            this._localPort = parseInt(x[2])
            this._remoteAddress = x[3]
            this._remotePort = parseInt(x[4])
        }
    }

    override get localAddress(): string {
        return this._localAddress
    }
    override get localPort(): number {
        return this._localPort
    }
    override get remoteAddress(): string {
        return this._remoteAddress
    }
    override get remotePort(): number {
        return this._remotePort
    }

    override async connect() {}
    override async close() {
        this.socket!.destroy()
    }

    send(buffer: ArrayBuffer): void {
        const view = new Uint8Array(buffer)
        switch (this.fake.mode) {
            case Mode.RECORD:            
                this.recordOut(view)
                break
            case Mode.REPLAY:
                if (this.fake.verbose) {
                    console.log(`FAKE: send`)
                }
                if (this.fake.testName === undefined) {
                    throw Error(`Fake is in replay mode but no expectation has been set up.`)
                }
                this.handleOut(view)
                this.handleIn()
                break

            case Mode.OFF:
                if (this.socket === undefined)
                    throw Error("yikes")
                this.socket.write(view)
        }
    }

    recordOut(view: Uint8Array) {
        const dump = `OUT\n${this.fake.toHexdump(view)}`
        if (this.fake.fd !== -1) {
            fs.writeSync(this.fake.fd, dump)
        }
        if (this.fake.verbose) {
            console.log(dump)
        }
        this.socket!.write(view)
    }

    handleOut(view: Uint8Array) {
        let line = this.fake.buffer.shift()
        if (line != "OUT") {
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
        if (line == "IN") {
            setTimeout(() => {
                const data = this.fake.fromHexdump()
                const b2 = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
                this.orb.socketRcvd(this, b2)
                this.handleIn()
            }, 0)
        } else {
            if (line !== undefined) {
                this.fake.buffer.unshift(line)
            }
        }
    }
}
