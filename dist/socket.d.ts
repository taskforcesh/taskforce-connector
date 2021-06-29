export interface Connection {
    port?: number;
    host?: string;
    password?: string;
    db?: number;
    uri?: string;
    tls?: object;
}
export declare const Socket: (name: string, server: string, token: string, connection: Connection, team?: string) => void;
