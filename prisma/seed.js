const { PrismaClient } = require('@prisma/client');
const {customers
    , invoices
    , revenue
    , users
} = require ("../app/lib/placeholder-data.js");

const prisma = new PrismaClient()

async function main(){
    console.log(new Date().getHours(),'Seeding database...')
    const user= await prisma.users.createMany({
        data: users
    })
    const customer = await prisma.customers.createMany({
        data: customers
    })
    const invoice = await prisma.invoices.createMany({
        data: invoices
    })
    const revenues = await prisma.revenue.createMany({
        data: revenue
    })

    console.log(user);
    console.log(customer);
    console.log(invoice);
    console.log(revenues);
    console.log(new Date().getHours(),'Seeding database ended...')

}

main()
.then(async () => {
    await prisma.$disconnect()
}).catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
})
