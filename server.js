const app = require('./app');
const PORT = process.env.PORT || 5400;

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
