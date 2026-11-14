import VaultPage from '@cvc/pages/vault';
import type { VaultPageProps } from '@cvc/pages/vault';

export default function HostVaultPage(props: VaultPageProps) {
    return <VaultPage {...props} navigation={{ home: '/dashboard' }} />;
}
