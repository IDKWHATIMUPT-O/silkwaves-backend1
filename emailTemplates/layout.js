module.exports = function layout(title, content) {

return `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8"/>

<title>${title}</title>

</head>

<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">

<table
width="100%"
cellpadding="0"
cellspacing="0"
style="background:#f5f5f5;padding:40px 0;"
>

<tr>

<td align="center">

<table
width="650"
cellpadding="0"
cellspacing="0"
style="
background:white;
border-radius:14px;
overflow:hidden;
">

<tr>

<td
style="
background:#00674E;
padding:30px;
text-align:center;
color:white;
font-size:32px;
font-weight:bold;
"
>

SILKWAVES

</td>

</tr>

<tr>

<td style="padding:40px;">

${content}

</td>

</tr>

<tr>

<td
style="
background:#F6F3EE;
padding:30px;
text-align:center;
color:#777;
font-size:13px;
"
>

<p>

Need help?

</p>

<p>

support@silkwaves.in

</p>

<p>

© ${new Date().getFullYear()} Silkwaves

</p>

</td>

</tr>

</table>

</td>

</tr>

</table>

</body>

</html>

`;

};