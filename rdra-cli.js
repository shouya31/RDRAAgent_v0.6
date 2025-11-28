#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * RDRA CLI - 任意のディレクトリでRDRA定義を実行
 */

// コマンドライン引数の解析
const args = process.argv.slice(2);
let workDir = args[0];

// ヘルプ表示
if (!workDir || workDir === '-h' || workDir === '--help') {
    console.log('');
    console.log('RDRA Agent - 要件定義支援ツール');
    console.log('');
    console.log('使用方法:');
    console.log('  rdra <作業ディレクトリ>');
    console.log('');
    console.log('例:');
    console.log('  rdra ./rdra-projects/my-system');
    console.log('  rdra /absolute/path/to/project');
    console.log('');
    console.log('作業ディレクトリには以下のファイルが必要です:');
    console.log('  - 初期要望.txt (必須)');
    console.log('  - 妥当性検証環境.csv (オプション)');
    console.log('');
    console.log('実行後、以下のフォルダに結果が出力されます:');
    console.log('  - 0_RDRAZeroOne/ (フェーズ別の中間結果)');
    console.log('  - 1_RDRA/ (最終的なRDRA定義)');
    console.log('  - 2_RDRASpec/ (仕様、オプション)');
    console.log('');
    process.exit(0);
}

// 作業ディレクトリを絶対パスに変換
workDir = path.resolve(workDir);

// 作業ディレクトリの確認・作成
if (!fs.existsSync(workDir)) {
    console.log(`📁 作業ディレクトリを作成: ${workDir}`);
    fs.mkdirSync(workDir, { recursive: true });
}

// 初期要望.txtの確認
const initialRequestPath = path.join(workDir, '初期要望.txt');
if (!fs.existsSync(initialRequestPath)) {
    console.log('');
    console.log('⚠️  初期要望.txt が見つかりません');
    console.log('');
    console.log('テンプレートを作成しますか? (y/n): ');
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('', (answer) => {
        rl.close();
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            const template = `システム名: 新しいシステム

要求:
- （ここに要求を記述）
- 例: ユーザー管理機能が欲しい
- 例: データを検索できるようにしたい

業務概要:
（ここに業務の概要を記述）

業務の背景:
（現状の課題や背景を記述）

アクター:
- 管理者
- 一般ユーザー
- （他のアクターを追加）

外部システム（オプション）:
- （連携する外部システムがあれば記述）

ビジネスポリシー（オプション）:
- （ビジネスルールや制約があれば記述）
`;
            
            fs.writeFileSync(initialRequestPath, template);
            console.log('');
            console.log(`✅ テンプレートを作成しました: ${initialRequestPath}`);
            console.log('');
            console.log('初期要望.txt を編集してから、再度このコマンドを実行してください:');
            console.log(`  rdra ${workDir}`);
            console.log('');
        } else {
            console.log('');
            console.log('初期要望.txt を作成してから、再度実行してください。');
            console.log('');
        }
        process.exit(0);
    });
    
    return;
}

// RDRAAgentのインストールディレクトリを取得
const rdraAgentDir = __dirname;

// RDRA_Knowledgeとmenu.jsへのシンボリックリンクを作成
const linksToCreate = [
    { src: path.join(rdraAgentDir, 'RDRA_Knowledge'), dest: path.join(workDir, 'RDRA_Knowledge') },
    { src: path.join(rdraAgentDir, 'menu.js'), dest: path.join(workDir, 'menu.js') }
];

console.log('');
console.log('🔗 RDRAAgentをセットアップ中...');

linksToCreate.forEach(({ src, dest }) => {
    // 既存のシンボリックリンクまたはファイルを削除
    if (fs.existsSync(dest)) {
        const stats = fs.lstatSync(dest);
        if (stats.isSymbolicLink()) {
            fs.unlinkSync(dest);
        }
    }
    
    // シンボリックリンクを作成
    try {
        fs.symlinkSync(src, dest);
    } catch (error) {
        console.error(`❌ シンボリックリンク作成エラー: ${error.message}`);
        process.exit(1);
    }
});

console.log('✅ セットアップ完了');
console.log('');
console.log(`📂 作業ディレクトリ: ${workDir}`);
console.log(`📄 初期要望: ${initialRequestPath}`);
console.log('');
console.log('📋 RDRAメニューを起動します...');
console.log('');

// menu.jsを作業ディレクトリで実行
const menuProcess = spawn('node', ['menu.js'], {
    cwd: workDir,
    stdio: 'inherit'
});

// プロセス終了時のクリーンアップ
const cleanup = () => {
    linksToCreate.forEach(({ dest }) => {
        if (fs.existsSync(dest)) {
            const stats = fs.lstatSync(dest);
            if (stats.isSymbolicLink()) {
                fs.unlinkSync(dest);
            }
        }
    });
};

menuProcess.on('close', (code) => {
    console.log('');
    
    if (code === 0) {
        console.log('🎉 RDRA定義が完了しました！');
        console.log('');
        console.log('📁 結果の場所:');
        
        const outputDirs = [
            { path: path.join(workDir, '1_RDRA'), label: '最終RDRA定義' },
            { path: path.join(workDir, '0_RDRAZeroOne'), label: 'フェーズ別結果' },
            { path: path.join(workDir, '2_RDRASpec'), label: '仕様（実行した場合）' }
        ];
        
        outputDirs.forEach(({ path: dirPath, label }) => {
            if (fs.existsSync(dirPath)) {
                console.log(`  ✅ ${label}: ${dirPath}`);
            }
        });
        console.log('');
    }
    
    cleanup();
    process.exit(code);
});

// Ctrl+C などでの中断時もクリーンアップ
process.on('SIGINT', () => {
    console.log('');
    console.log('⚠️  中断されました');
    cleanup();
    process.exit(130);
});

process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
});

