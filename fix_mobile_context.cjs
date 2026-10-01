const fs = require('fs');
const path = require('path');

const file = 'C:\\LNCZ\\proyecto-catastro-2026\\movil\\src\\context\\MobileContext.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetBlock = `  const permissions = {
    isAdminOrSuperAdmin,
      permissions,
      isBrigadista,
      isGeoportalUser,
    isBrigadista,
    isGeoportalUser,
    canEditServerPredios: isGeoportalUser,
    canDeleteServerPredios: isAdminOrSuperAdmin,
    canEditLocalPredios: true,
    canDeleteLocalPredios: true,
    canCreatePredios: true
  };`;

const replacementBlock = `  const permissions = {
    isAdminOrSuperAdmin,
    isBrigadista,
    isGeoportalUser,
    canEditServerPredios: isGeoportalUser,
    canDeleteServerPredios: isAdminOrSuperAdmin,
    canEditLocalPredios: true,
    canDeleteLocalPredios: true,
    canCreatePredios: true
  };`;

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, replacementBlock);
} else {
  // Regex fallback
  content = content.replace(
    /const permissions = \{[\s\S]*?canCreatePredios: true\s*\};/,
    replacementBlock.trim()
  );
}

// In Provider value:
if (!content.includes('permissions,') && content.includes('isAdminOrSuperAdmin,')) {
  content = content.replace(
    'isAdminOrSuperAdmin,\n      isSyncing,',
    'isAdminOrSuperAdmin,\n      permissions,\n      isBrigadista,\n      isGeoportalUser,\n      isSyncing,'
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('MobileContext permissions fix applied successfully!');
