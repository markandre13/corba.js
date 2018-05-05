/*
 *  corba.js Object Request Broker (ORB) and Interface Definition Language (IDL) compiler
 *  Copyright (C) 2018 Mark-André Hopf <mhopf@mark13.org>
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as WebSocket from "ws"

import * as Browser from "./orb"
export { Skeleton, Stub } from "./orb"

export class ORB extends Browser.ORB {
    constructor(orb?: Browser.ORB) {
        super(orb)
    }

    ///
    /// Server
    ///

/*  FIXME: add wss:// support
    const https = require('https');
    const fs = require('fs');
    const WebSocket = require('ws');
    const server = https.createServer({
        cert: fs.readFileSync('../test/fixtures/certificate.pem'),
        key: fs.readFileSync('../test/fixtures/key.pem')
    });
    const wss = new WebSocket.Server({ server });
*/

    async listen(host: string, port: number): Promise<void> {
        return new Promise<void>( (resolve, reject) => {
            const wss = new WebSocket.Server({host: host,port: port}, function() {
                resolve()
            })
            wss.on("error", (error: any) => {
                switch(error.code) {
                    case "EADDRINUSE":
                        reject(new Error("another server is already running at "+error.address+":"+error.port))
                        break
                    default:
                        reject(error)
                }
            })
            wss.on("connection", (socket) => {
                let orb = new ORB(this)
                orb.socket = socket
                orb.accept()
            })
        })
    }
    
    accept() {
        this.socket.onmessage = (message: any) => {	// FIXME: we have almost the same code in send()
            if (this.debug>0) {
                console.log("ORB.accept(): got message ", message.data)
            }
            let msg = JSON.parse(String(message.data))
            if (msg.corba !== "1.0") {
                throw Error("expected corba version 1.0 but got "+msg.corba)
            }
            if (msg.create !== undefined) {
                this.handleCreate(msg)
            } else
            if (msg.method !== undefined) {
                this.handleMethod(msg)
            } else
            if (msg.list_initial_references !== undefined) {
                this.handleListInitialReferences(msg)
            } else
            if (msg.resolve_initial_references !== undefined) {
                this.handleResolveInitialReferences(msg)
            }
        }
        this.socket.onerror = (error: any) => {
            console.log("error", error)
        }
        this.socket.onclose = () => {
            this.release()
            console.log("lost connection to client")
        }
    }
    
}
