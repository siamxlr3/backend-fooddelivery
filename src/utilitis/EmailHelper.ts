import nodemailer from "nodemailer"

export const EmailSend=async (EmailTo:string,EmailText:string,EmailSubject:string)=>{

    let  transport= nodemailer.createTransport({
        host:"smtp.gmail.com",
        port:587,
        secure:false,
        auth:{user:"siamrezwanahmed@gmail.com",pass:process.env.Pass},
        tls:{rejectUnauthorized:false}
    })


    let mailOption={
        from:'Food Delivery App<siamrezwanahmed@gmail.com>',
        to:EmailTo,
        subject:EmailSubject,
        text:EmailText
    }

    return await transport.sendMail(mailOption)
}