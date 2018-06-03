

function recebeRequest(msg){    

    switch(tipo){
        case 'reclamacao':
            mensagemDeBoasVindas();
            break;


    }
    
    mostraCategoriaReclamacao();
    processaTipoReclamacao();
    perguntaTituloReclamacao();
    perguntaDescricao();
    mostraDatePicker();
    perguntaPorImagemOuVideo();
    mostraMapaParaSelecionarLocal(); // Google Maps?
    mensagemDeAgradecimento();
    informacoesAdicionais();
}

function informacoesAdicionais(){
    perguntaOrientacaoSexual();
    perguntaFaixaEtaria();    
    perguntaSeGostouDaFerramenta();
}

function mostraCategoriaReclamacao(){

    
}