'use server'
import { z } from 'zod';
import {Invoice} from "@/app/lib/definitions";
import {PrismaClient} from "@prisma/client";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
    id: z.string(),
    customer_id: z.string({
        invalid_type_error: 'Please select a customer',
    }),
    amount: z.coerce.number().gt(0, 'Amount must be greater than $0'),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select a status',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const prismaClient = new PrismaClient();

export type State = {
    errors?: {
        customer_id?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State,formData: FormData) {
    const validatedFields  = CreateInvoice.safeParse({
        customer_id: String(formData.get('customer_id')),
        amount: Number(formData.get('amount')),
        status: formData.get('status') as 'pending' | 'paid'
    });
    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }
    const amountInCents = Math.round(validatedFields.data.amount * 100);
    const date = new Date();
    try {
        await prismaClient.invoices.create({
            data: {
                customer_id: validatedFields.data.customer_id,
                status: validatedFields.data.status,
                amount: amountInCents,
                date: date
            },
        })
    }catch (e) {
        return {
            message: 'Failed to create invoice',
        }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {

    const rawFormData: Invoice = {
        customer_id: String(formData.get('customer_id')),
        amount: Number(formData.get('amount')),
        status: formData.get('status') as 'pending' | 'paid'
    };
    const amountInCents = Math.round(rawFormData.amount * 100);
    try {
        await prismaClient.invoices.update({
            where: {
                id: id
            },
            data: {
                customer_id: rawFormData.customer_id,
                amount: amountInCents,
                status: rawFormData.status
            }
        });
    }catch (e) {
       return {
           message: 'Failed to update invoice',
       }
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        await prismaClient.invoices.delete({
            where: {
                id: id
            }
        });
    }catch (e) {
        return {
            message: 'Failed to delete invoice',
        }
    }
    revalidatePath('/dashboard/invoices');
}
