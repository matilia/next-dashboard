import {User,} from './definitions';
import {formatCurrency} from './utils';
import connection from "@/app/lib/db.js";
import sql from 'sql-template-strings'
import {PrismaClient} from "@prisma/client";
import {unstable_noStore as noStore} from "next/cache";

const prismaClient = new PrismaClient();

export async function fetchRevenue() {
    noStore();
    try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return await prismaClient.revenue.findMany();
    } catch (error) {
        throw new Error('Failed to fetch revenue data.');
    } finally {
        await prismaClient.$disconnect();
    }
}

export async function fetchLatestInvoices() {
    noStore();
    try {
        const data = await prismaClient.invoices.findMany({
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image_url: true
                    }
                },
            },
            take: 5,
            orderBy: {
                date: 'desc'
            }
        });
        if (!data) {
            console.error('No invoices found.');
        }
        return data.map(invoice => ({
            ...invoice,
            amount: formatCurrency(invoice.amount),
        }));
    } catch (error) {
        throw new Error('Failed to fetch the latest invoices.');
    } finally {
        await prismaClient.$disconnect();
    }
}

export async function fetchCardData() {
    noStore();
    try {
        const invoiceCountPromise = prismaClient.invoices.count();
        const customerCountPromise = prismaClient.customers.count();
        const invoiceStatusPromise = connection.query(sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`);

        const data = await Promise.all([
            invoiceCountPromise,
            customerCountPromise,
            invoiceStatusPromise,
        ]);

        const numberOfInvoices = Number(data[0] ?? '0');
        const numberOfCustomers = Number(data[1] ?? '0');
        const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
        const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');

        return {
            numberOfInvoices,
            numberOfCustomers,
            totalPaidInvoices,
            totalPendingInvoices,
        };
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch card data.');
    }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(query: string, currentPage: number) {
    noStore();
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    try {
        const invoices = await connection.query(sql`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `);

        return invoices.rows;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch invoices.');
    }
}

export async function fetchInvoicesPages(query: string) {
    noStore();
    try {
        const count = await connection.query(sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `);
        const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
        return totalPages;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch total number of invoices.');
    }
}

export async function fetchInvoiceById(id: string) {
    noStore();
    try {
        const invoice = await prismaClient.invoices.findUnique({where: {id: id}});
        if (!invoice) {
            console.error('No customers found.');
        }else{
            const amount = invoice.amount / 100;
            return {
                ...invoice,
                amount: amount,
            };
        }
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch invoice.');
    }
}

export async function fetchCustomers() {
    noStore();
    try {
        const customers = await prismaClient.customers.findMany({
            orderBy: {
                name: 'asc'
            }
        });
        if (!customers) {
            console.error('No customers found.');
        }else {
            return customers;
        }
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch all customers.');
    }
}

export async function fetchFilteredCustomers(query: string) {
    noStore();
    try {
        const data = await connection.query(sql`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `);

        const customers = data.rows.map((customer: { total_pending: number; total_paid: number; }) => ({
            ...customer,
            total_pending: formatCurrency(customer.total_pending),
            total_paid: formatCurrency(customer.total_paid),
        }));

        return customers;
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch customers table.');
    }
}

export async function getUser(email: string) {
    noStore();
    try {
        const user = await connection.query(sql`SELECT * FROM users WHERE email=${email}`);
        return user.rows[0] as User;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}
