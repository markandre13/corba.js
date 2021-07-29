import typescript from 'rollup-plugin-typescript2'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default [{
    input: 'src/idl/idl.ts',
    output: {
        name: 'idl',
        file: 'lib/idl-compiler.js',
        format: 'commonjs',
        sourcemap: true,
        extend: true
    },
    plugins: [
        typescript({
            tsconfigOverride: {
                compilerOptions: {
                    module: "esnext"
                },
            },
            include: [
                "src/**/*.ts",
            ],
            sourceMap: true
        }),
        nodeResolve(),
        commonjs(),
    ]
}]
