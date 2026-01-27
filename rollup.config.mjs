import resolve, { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import dts from 'rollup-plugin-dts'
import replace from '@rollup/plugin-replace'
import { babel } from '@rollup/plugin-babel';

// const packageJson = require('./package.json')

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                file: "dist/index.cjs.js",
                format: 'cjs',
                sourcemap: true
            },
            {
                file: "dist/index.esm.js",
                format: 'esm',
                sourcemap: true
            },
            {
                file: 'dist/sdk.umd.js',
                format: 'umd',
                name: 'adServe',
                sourcemap: true
            },
            {
                file: 'dist/sdk.umd.min.js',
                format: 'umd',
                name: 'adServe',
                sourcemap: true,
                plugins: [terser(
                    {
                        compress: {
                            // 删除所有的 console 语句
                            drop_console: true,
                            
                            // 删除所有的 debugger 语句
                            drop_debugger: true,
                            
                            // 其他压缩选项
                            pure_funcs: ['console.log', 'console.info', 'console.warn', 'console.error'],
                            
                            // 删除未使用的函数和变量
                            unused: true,
                            
                            // 死代码消除
                            dead_code: true
                        },
                        format: {
                            // 保留注释（可选）
                            comments: false
                        },
                        mangle: {
                            // 混淆变量名
                            toplevel: true
                        }
                    }
            )]
            }
        ],
        treeshake: {
            preset: 'recommended',
            moduleSideEffects: "no-external",//false,
            propertyReadSideEffects: false,
            tryCatchDeoptimization: false,
        },
        plugins: [
            replace({
                'process.env.NODE_ENV': JSON.stringify('production'),
                // 'process.env.VERSION': JSON.stringify(packageJson.version),
                preventAssignment: true
            }),
            // resolve(),
            nodeResolve({
                browser: true,
                preferBuiltins: false
            }),
            commonjs({
                include: /node_modules/,
                exclude: ['src/**']
            }),
            // babel({
            //     babelHelpers: 'bundled',
            //     exclude: 'node_modules/**',
            //     presets: [
            //         ['@babel/preset-env', {
            //             targets: {
            //                 browsers: ['last 2 versions', '> 1%', 'IE 11']
            //             },
            //             modules: false,
            //             useBuiltIns: 'usage',
            //             corejs: 3
            //         }]
            //     ]
            // }),
            typescript({tsconfig: './tsconfig.json'}),
        ],
        // external: ['axios']
    },
    {
        input: 'dist/types/src/index.d.ts',
        output: [{file: 'dist/index.d.ts', format: 'es'}],
        plugins: [dts()]
    }]