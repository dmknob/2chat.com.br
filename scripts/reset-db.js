require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Tenta pegar do .env, ou usa o padrão de dev
const dbName = process.env.DB_FILE;
const dbPath = path.join(__dirname, '..', dbName);

console.log(`\n⚠️  Iniciando DB Reset: Alvo => ${dbName}`);

// Arquivos auxiliares do WAL
const filesToDelete = [
    dbPath,
    `${dbPath}-wal`,
    `${dbPath}-shm`
];

let deletedFiles = 0;

filesToDelete.forEach(file => {
    if (fs.existsSync(file)) {
        try {
            fs.unlinkSync(file);
            deletedFiles++;
        } catch (err) {
            console.error(`Erro ao apagar ${file}:`, err.message);
        }
    }
});

if (deletedFiles > 0) {
    console.log(`✅ Apagados ${deletedFiles} arquivos atrelados ao banco de dados (${dbName}).`);
} else {
    console.log(`ℹ️ Banco de dados ${dbName} não existia. Nenhuma exclusão necessária.`);
}

console.log('🔄 Executando db:setup...');
try {
    execSync('npm run db:setup', { stdio: 'inherit' });
} catch (err) {
    console.error('❌ Falha ao rodar db:setup:', err.message);
    process.exit(1);
}

console.log('🌱 Executando db:seed...');
try {
    execSync('npm run db:seed', { stdio: 'inherit' });
    console.log('\n✅ DB Reset concluído com sucesso!');
} catch (err) {
    console.error('❌ Falha ao rodar db:seed:', err.message);
    process.exit(1);
}
