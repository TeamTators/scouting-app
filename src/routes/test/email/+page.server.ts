import { emails } from '$lib/emails';

export const load = async () => {
    const [newsletter] = await emails.newsletter({
       first_name: 'Test',
       last_name: 'User',
    });
    return {
        newsletter,
    }
}